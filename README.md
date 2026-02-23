# <img src="web/public/logo.svg" width="40" height="40" align="center" style="margin-right: 10px;" /> Gitship

**Gitship** is a Kubernetes-native PaaS designed for zero-config deployments. Just push your code, and Gitship handles the rest—building container images, managing deployments, and providing real-time monitoring.

![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)
![Kubernetes](https://img.shields.io/badge/kubernetes-native-blue.svg)

## Features

- **Zero-Config Builds**: Automatically detects Node.js, Python, or Go projects and builds them using Kaniko.
- **Live Stats Dashboard**: Real-time monitoring of CPU, RAM, and storage usage.
- **Standalone Integrations**: Support for external services like Cloudflare Tunnel for ingress-less exposure.
- **SSH & Private Repos**: Seamless integration with GitHub via SSH deploy keys.
- **Personalized SSL**: Automated HTTPS certificates using per-user Let's Encrypt Issuers.
- **User Isolation**: Automatic provisioning of secure, ID-based namespaces (`gitship-u-{ID}`) for every user.

## Installation

Deploy Gitship to your cluster with a single command:

```bash
kubectl apply -f https://github.com/gitshipio/gitship/releases/latest/download/install.yaml
```

### Configuration

Before using the dashboard, create the required secret in the `gitship-system` namespace. You will need a GitHub OAuth App.

```bash
kubectl create namespace gitship-system
kubectl create secret generic gitship-dashboard-secrets -n gitship-system \
  --from-literal=AUTH_SECRET=$(openssl rand -base64 32) \
  --from-literal=AUTH_GITHUB_ID=your_github_client_id \
  --from-literal=AUTH_GITHUB_SECRET=your_github_client_secret \
  --from-literal=GITHUB_WEBHOOK_SECRET=your_webhook_secret
```

Once deployed, access the dashboard via the created Service or Ingress (depending on your cluster setup).

### Customization

You can customize the registry, resource quotas, and image defaults by editing the ConfigMaps before or after deployment:

- **Controller Config**: `gitship-controller-config` (in `gitship-system`)
- **Dashboard Config**: `gitship-dashboard-config` (in `gitship-system`)

Example to change the registry:
```bash
kubectl edit configmap gitship-controller-config -n gitship-system
# Change REGISTRY_PULL_URL and REGISTRY_PUSH_URL, then restart:
kubectl rollout restart deployment gitship-controller-manager -n gitship-system
```

## Usage

Gitship uses Custom Resources to manage applications. Create a `GitshipApp` YAML file to deploy your project:

```yaml
apiVersion: gitship.io/v1alpha1
kind: GitshipApp
metadata:
  name: my-app
  namespace: gitship-u-12345678  # Use your GitHub ID
spec:
  repoUrl: "https://github.com/username/repository"
  source:
    type: "branch"
    value: "main"
  replicas: 1
  ports:
    - name: http
      port: 80
      targetPort: 3000
```

Apply it to the cluster:

```bash
kubectl apply -f my-app.yaml
```

## Contributing

Contributions are welcome. Please open an issue or submit a pull request.
