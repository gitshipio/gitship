import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub({
    authorization: { 
      params: { 
        scope: "read:user repo",
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
        // @ts-ignore login exists on github profile
        token.githubUsername = profile?.login?.toLowerCase()
        // @ts-ignore id exists on github profile
        token.githubId = profile?.id?.toString()
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
      return session
    },
  },
})
