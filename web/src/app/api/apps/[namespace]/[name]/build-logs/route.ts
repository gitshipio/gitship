import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { k8sCoreApi, k8sBatchApi } from "@/lib/k8s"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ namespace: string, name: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { namespace, name } = await params

  try {
    // 1. Find the latest build job for this app
    const jobsRes = await k8sBatchApi.listNamespacedJob({
        namespace,
        labelSelector: `gitship.io/app=${name}`
    })
    
    const jobs = jobsRes.items || []
    if (jobs.length === 0) return NextResponse.json({ logs: "No build jobs found." })

    // Sort by creation timestamp descending
    const latestJob = jobs.sort((a, b) => 
        (b.metadata?.creationTimestamp?.getTime() || 0) - (a.metadata?.creationTimestamp?.getTime() || 0)
    )[0]

    const jobName = latestJob.metadata?.name
    if (!jobName) return NextResponse.json({ logs: "Latest job has no name." })

    // 2. Find the pod for this job
    const podsRes = await k8sCoreApi.listNamespacedPod({
        namespace,
        labelSelector: `job-name=${jobName}`
    })

    const pods = podsRes.items || []
    if (pods.length === 0) return NextResponse.json({ logs: `Job ${jobName} is active but has no pods yet.` })

    const podName = pods[0].metadata?.name
    if (!podName) return NextResponse.json({ logs: "Pod has no name." })

    // 3. Get logs from the 'kaniko' container
    const logRes = await k8sCoreApi.readNamespacedPodLog({
        name: podName,
        namespace,
        container: "kaniko",
        tailLines: 500
    })

    return NextResponse.json({ 
        logs: logRes,
        jobName,
        status: latestJob.status 
    })
  } catch (e: any) {
    console.error(`[Logs] Failed to fetch build logs for ${name}:`, e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
