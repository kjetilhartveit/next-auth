import emailSignin from "../email/signin.js"
import { SignInError } from "../../errors.js"
import { getAuthorizationUrl } from "../oauth/authorization-url.js"
import { handleAuthorized } from "./shared.js"

import type {
  Account,
  InternalOptions,
  RequestInternal,
  ResponseInternal,
} from "../../types.js"

/**
 * Initiates the sign in process for OAuth and Email flows .
 * For OAuth, redirects to the provider's authorization URL.
 * For Email, sends an email with a sign in link.
 */
export async function signin(
  query: RequestInternal["query"],
  body: RequestInternal["body"],
  options: InternalOptions<"oauth" | "email">
): Promise<ResponseInternal> {
  const { url, logger, provider } = options
  try {
    if (provider.type === "oauth" || provider.type === "oidc") {
      return await getAuthorizationUrl(query, options)
    } else if (provider.type === "email") {
      const email = provider.normalizeIdentifier(body?.email)

      const user = (await options.adapter!.getUserByEmail(email)) ?? {
        id: email,
        email,
        emailVerified: null,
      }

      const account: Account = {
        providerAccountId: email,
        userId: user.id,
        type: "email",
        provider: provider.id,
      }

      const unauthorizedOrError = await handleAuthorized(
        { user, account, email: { verificationRequest: true } },
        options
      )

      if (unauthorizedOrError) return unauthorizedOrError

      const redirect = await emailSignin(email, options)
      return { redirect }
    }
    return { redirect: `${url}/signin` }
  } catch (e) {
    const error = new SignInError(e as Error, { provider: provider.id })
    logger.error(error)
    url.searchParams.set("error", error.name)
    url.pathname += "/error"
    return { redirect: url.toString() }
  }
}
