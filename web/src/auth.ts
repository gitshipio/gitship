import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub({
    authorization: { 
      params: { 
        scope: "read:user repo admin:repo_hook",
        prompt: "consent",
      } 
    },
  })],
  callbacks: {
    authorized: async ({ auth }) => {
      // Logged in users are authenticated, otherwise redirect to login page
      return !!auth
    },
    jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token
        // @ts-expect-error login exists on github profile
        token.githubUsername = profile?.login?.toLowerCase()
        token.githubId = profile?.id?.toString()
        token.email = profile?.email
      }
      return token
    },
    session({ session, token }) {
      // @ts-expect-error accessToken is not typed in default session
      session.accessToken = token.accessToken
      // @ts-expect-error githubUsername is not typed
      session.user.githubUsername = token.githubUsername
      // @ts-expect-error githubId is not typed
      session.user.githubId = token.githubId
      session.user.email = token.email || session.user.email
      return session
    },
  },
})
