import 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** Never refresh or resend this request. Required for destructive account submission. */
    noAuthReplay?: boolean;
    retry?: false;
    /** Session generation captured when a private operation began. */
    sessionGeneration?: number;
  }
  export interface InternalAxiosRequestConfig {
    _retry?: boolean;
    noAuthReplay?: boolean;
    retry?: false;
    sessionGeneration?: number;
  }
}
