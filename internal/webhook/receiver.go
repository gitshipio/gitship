package webhook

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	gitshipiov1alpha1 "github.com/gitshipio/gitship/api/gitship.io/v1alpha1"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"
)

type Receiver struct {
	Client client.Client
}

type PushEvent struct {
	Ref        string `json:"ref"`
	Repository struct {
		CloneURL string `json:"clone_url"`
		HTMLURL  string `json:"html_url"`
	} `json:"repository"`
}

func (r *Receiver) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	ctx := context.Background()
	logger := log.FromContext(ctx)

	// Read Payload
	payload, err := io.ReadAll(req.Body)
	if err != nil {
		http.Error(w, "Failed to read body", http.StatusBadRequest)
		return
	}
	defer func() {
		_ = req.Body.Close()
	}()

	// Verify Signature (Global Secret from Env)
	secret := os.Getenv("GITHUB_WEBHOOK_SECRET")
	if secret != "" {
		signature := req.Header.Get("X-Hub-Signature-256")
		if signature == "" {
			http.Error(w, "Missing signature", http.StatusUnauthorized)
			return
		}
		if !verifySignature(payload, signature, []byte(secret)) {
			http.Error(w, "Invalid signature", http.StatusUnauthorized)
			return
		}
	}

	// Parse Event
	var event PushEvent
	if err := json.Unmarshal(payload, &event); err != nil {
		http.Error(w, "Failed to parse JSON", http.StatusBadRequest)
		return
	}

	rawRef := event.Ref // e.g., refs/heads/main
	branch := strings.TrimPrefix(rawRef, "refs/heads/")

	// Find matching GitshipApps
	var apps gitshipiov1alpha1.GitshipAppList
	if err := r.Client.List(ctx, &apps); err != nil {
		logger.Error(err, "Failed to list GitshipApps")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	triggeredCount := 0

	for _, app := range apps.Items {
		// Match Source
		source := app.Spec.Source
		isMatch := false

		switch source.Type {
		case "branch":
			targetBranch := source.Value
			if targetBranch == "" || targetBranch == "HEAD" {
				targetBranch = "main" // Simplified fallback
			}
			if targetBranch == branch {
				isMatch = true
			}
		case "tag":
			if strings.HasPrefix(rawRef, "refs/tags/") {
				tag := strings.TrimPrefix(rawRef, "refs/tags/")
				if tag == source.Value {
					isMatch = true
				}
			}
		}

		if !isMatch {
			continue
		}

		// Match URL (normalize)
		targetURL := normalizeURL(app.Spec.RepoURL)
		eventURL := normalizeURL(event.Repository.CloneURL)
		eventURL2 := normalizeURL(event.Repository.HTMLURL)

		if targetURL != eventURL && targetURL != eventURL2 {
			continue
		}

		// Trigger Update
		// We use a Merge Patch to update annotations
		patch := client.MergeFrom(app.DeepCopy())
		if app.Annotations == nil {
			app.Annotations = make(map[string]string)
		}
		app.Annotations["gitship.io/last-webhook-trigger"] = time.Now().Format(time.RFC3339)

		if err := r.Client.Patch(ctx, &app, patch); err != nil {
			logger.Error(err, "Failed to patch GitshipApp", "Name", app.Name)
			continue
		}

		logger.Info("Triggered GitshipApp via Webhook", "Name", app.Name)
		triggeredCount++
	}

	if triggeredCount > 0 {
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprintf(w, "Triggered %d GitshipApps", triggeredCount)
	} else {
		w.WriteHeader(http.StatusOK) // 200 OK even if no match, to satisfy GitHub
		_, _ = fmt.Fprint(w, "No matching GitshipApps found")
	}
}

func normalizeURL(u string) string {
	u = strings.TrimSuffix(u, ".git")
	u = strings.TrimPrefix(u, "https://")
	u = strings.TrimPrefix(u, "http://")
	u = strings.TrimPrefix(u, "git://")
	return strings.ToLower(u)
}

func verifySignature(payload []byte, signature string, secret []byte) bool {
	parts := strings.SplitN(signature, "=", 2)
	if len(parts) != 2 || parts[0] != "sha256" {
		return false
	}

	mac := hmac.New(sha256.New, secret)
	mac.Write(payload)
	expectedMAC := mac.Sum(nil)
	expectedSig := hex.EncodeToString(expectedMAC)

	return hmac.Equal([]byte(parts[1]), []byte(expectedSig))
}
