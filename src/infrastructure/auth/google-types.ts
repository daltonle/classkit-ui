export type GoogleUser = {
  id: string;
  email: string;
  name: string;
  picture?: string;
};

export type AuthState =
  | { status: "signed_out" }
  | { status: "signed_in"; user: GoogleUser; drive: "not_authorized" }
  | { status: "signed_in"; user: GoogleUser; drive: "authorized" }
  | { status: "signed_in"; user: GoogleUser; drive: "reconnect_required" };

type TokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

export type GoogleIdentityApi = {
  accounts: {
    id: {
      initialize: (configuration: {
        client_id: string;
        callback: (response: { credential: string }) => void;
      }) => void;
      prompt: () => void;
      revoke: (hint: string, callback?: () => void) => void;
    };
    oauth2: {
      initTokenClient: (configuration: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: { type?: string; message?: string }) => void;
      }) => { requestAccessToken: (options?: { prompt?: string }) => void };
      revoke: (token: string, callback?: () => void) => void;
    };
  };
};
