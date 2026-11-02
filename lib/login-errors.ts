import { CredentialsSignin } from "@auth/core/errors"

export class AccountAlreadySignedIn extends CredentialsSignin {
  code = "account_already_signed_in"
}
