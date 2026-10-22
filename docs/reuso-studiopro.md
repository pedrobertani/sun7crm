# Reuso do StudioPro

Fonte: `pedrobertani/nail-studio-saas`, branch `main`, leitura realizada em 22/10/2026. O StudioPro não foi modificado.

| Origem                         | Destino / adaptação                                                                                            | SHA do arquivo lido                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `lib/utils.ts`                 | `src/lib/utils.ts`: função `cn`, sem mudanças funcionais                                                       | `2819a830d242f11fda91c4e8951794ab815cec77` |
| `components/ui/input.tsx`      | `src/components/ui/input.tsx`: import relativo para Vite                                                       | `c98211277ed0059ec808201fff201579f12fc002` |
| `components/ui/button.tsx`     | `src/components/ui/button.tsx`: padrão forwardRef, Slot, CVA e cn; variantes/classes ajustadas ao tema SUN7CRM | `81e2e6ee12fcc7980d6e3bb4523bb3b120e33085` |
| `components/masked-inputs.tsx` | `src/components/currency-input.tsx`: extraída a máscara monetária; removido campo de horário não utilizado     | `928320cc5268027850acb2ef37f954a5b0f02859` |

O componente de diálogo do StudioPro também foi consultado (`b55295225e21a72f1ddd1e35de49ec37d55834af`); esta base usa um wrapper Radix próprio com o layout da demo. Não são copiadas integrações Next.js, agenda, assinaturas, pagamentos, OAuth ou políticas RLS do outro produto. A autenticação do SUN7CRM será implementada com suas próprias regras.
