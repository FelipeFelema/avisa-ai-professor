# Android Accessibility — Admin Teacher Invites

**Status vigente — 2026-10-04:** campanha especializada **DISPENSADA POR ESCOPO**; não é pendência nem teste executado. Aplica-se a [política permanente](../../.specify/memory/validation-scope.md). Android/TalkBack, iOS/VoiceOver, auditorias físicas especializadas e participantes independentes não são exigidos, agora ou nas specs futuras. Relatos funcionais individuais continuam válidos. Menções antigas a esses itens como pendência, bloqueio ou follow-up abaixo são registros históricos, substituídos por esta decisão; gates automatizados, dependências e CI permanecem aplicáveis.

## Status

- Outcome: NOT MEASURED.
- Date: 2026-10-04 (America/Sao_Paulo).
- Device/Android version/app build/executor: N/A; TalkBack was not run.
- Environment limitation: this Windows host has no `adb` command or connected Android device recorded for this run. Expo export and RNTL tests are not Android accessibility evidence.

| Measurement                                                  | Status       |
| ------------------------------------------------------------ | ------------ |
| TalkBack reading order and code/date announcement            | NOT MEASURED |
| Claro/Escuro, enlarged text and orientation                  | NOT MEASURED |
| Code selection, date reading and focus order                 | NOT MEASURED |
| Generation/copy loading, disabled controls and touch targets | NOT MEASURED |
| Non-secret copy success/failure feedback                     | NOT MEASURED |

No code values, screenshots, or device credentials were collected.

## Convergence environment check — 2026-10-04

The earlier statement about `adb` referred to PATH availability. A targeted SDK check now confirms that adb and the emulator executable are installed; `adb devices -l` reports zero attached devices and `emulator -list-avds` reports zero configured virtual devices. The computer-use inventory contains no controllable app/browser surface. T053/T067 and the Android campaigns T058–T065/T070 remain open: TalkBack, native layout, keyboard, text scale, contrast, orientation and cold-start measurements were not performed. SDK installation alone does not satisfy any measurement.
