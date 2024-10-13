import { KapiyaClient } from "./core";

const kapiya = new KapiyaClient({
  async prepare() {
    //
  },
  sessionCookie: {
    attributes: {
      secure: process.env.NODE_ENV === "production",
    },
  },
  getUserAttributes: (attributes: any) => {
    return {
      githubId: attributes.github_id,
      username: attributes.username,
    };
  },
  strategies: {
    github: {
      clientId: "string",
      clientSecret: "string",
      async handleSignUp() {
        //
      },
      async handleSignIn() {
        //
      },
      async handleSignOut() {
        //
      },
      async fetchSession(userId) {
        // get and return session from db
        return [];
      },
      async updateSessionExpiry() {
        //
      },
    },
  },
});
