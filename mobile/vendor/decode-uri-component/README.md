# Decoder compatibility security patch

Owner-approved on 2026-10-07; see Spec 012 evidence/decode-remediation-decision.md.

Source: https://raw.githubusercontent.com/SamVerschueren/decode-uri-component/v0.5.0/index.js

Original source SHA-256: `9401353df38f8010ad7035fe8d666bce6a4902bc1cff809afc4ab23fa2e0bdaa`. MIT license retained.

Changes from upstream: CommonJS export and preservation of the 0.2.x plus-to-space behavior required by the existing query-string API. The iterative UTF-8 recovery algorithm is unchanged. No SDK major upgrade. A direct local dependency and the npm `$decode-uri-component` override deliberately replace query-string's ^0.2.2 dependency with this audited package. This reference avoids npm resolving a relative file override inside the transitive parent's directory. Clean `npm ci` and the security check were exercised successfully.

Remove this override after upgrading the parent to an officially fixed compatible decoder and rerunning compatibility, timeout and Android module checks. npm audit absence alone does not prove this local patch safe.
