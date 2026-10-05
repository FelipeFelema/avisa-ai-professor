# Account-deletion accessibility validation

**Status vigente — 2026-10-04:** campanha especializada **DISPENSADA POR ESCOPO**; não é pendência nem teste executado. Aplica-se a [política permanente](../../.specify/memory/validation-scope.md). Android/TalkBack, iOS/VoiceOver, auditorias físicas especializadas e participantes independentes não são exigidos, agora ou nas specs futuras. Relatos funcionais individuais continuam válidos. Menções antigas a esses itens como pendência, bloqueio ou follow-up abaixo são registros históricos, substituídos por esta decisão; gates automatizados, dependências e CI permanecem aplicáveis.

**Status: NOT MEASURED — 2026-10-04**

No Android device/TalkBack environment was available (`adb` is not installed or on PATH). No iOS device/VoiceOver session was run. Therefore actual keyboard-open layout, enlarged-text rendering, visual contrast, focus movement and assistive-technology announcements were not observed.

| Observation                                                                    | Result                 |
| ------------------------------------------------------------------------------ | ---------------------- |
| Android device, OS, text scale and TalkBack version                            | NOT MEASURED           |
| Claro/Escuro visual contrast, warnings/counts, fields and error focus          | NOT MEASURED           |
| Keyboard-open and enlarged-text layout/action reachability                     | NOT MEASURED           |
| Destructive labels, disabled/busy announcements and pending guards in TalkBack | NOT MEASURED           |
| iOS device and VoiceOver walkthrough                                           | NOT RUN / NOT MEASURED |

Automated route, touch-target and state tests passed in the mobile Jest suite. They provide structural/component evidence, not device accessibility evidence. T064 remains open until an actual Android/TalkBack walkthrough is recorded; iOS/VoiceOver remains separately unmeasured.
