import { exec } from "child_process"
import { promisify } from "util"
import fs from "fs/promises"
import path from "path"
import os from "os"

const execAsync = promisify(exec)

export async function generateSSHKeyPair(email: string = "gitship@bot") {
    const tmpDir = os.tmpdir()
    const keyPath = path.join(tmpDir, `id_ed25519_${Date.now()}`)

    try {
        // Generate Ed25519 key pair with no passphrase
        // -t ed25519: Type
        // -C comment: Comment (email)
        // -f output_file: Path
        // -N "": Empty passphrase
        // -q: Quiet mode
        await execAsync(`ssh-keygen -t ed25519 -C "${email}" -f "${keyPath}" -N "" -q`)

        const privateKey = await fs.readFile(keyPath, "utf-8")
        const publicKey = await fs.readFile(`${keyPath}.pub`, "utf-8")

        // Cleanup
        await fs.unlink(keyPath)
        await fs.unlink(`${keyPath}.pub`)

        return { privateKey, publicKey }
    } catch (error) {
        console.error("Failed to generate SSH key pair:", error)
        throw new Error("Failed to generate SSH key pair")
    }
}
