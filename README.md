# Indikei · site público

Landing, vitrine de consultores, perfil, login e cadastro (stepper + Gov.br), implementados a partir do protótipo
`Indikei Site.dc.html` (Claude Design). Stack: Vite + React + TypeScript + Tailwind (preset de tokens da Indikei) + lucide-react.

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # gera dist/
```

Rotas: `/`, `/consultores`, `/consultores/:id`, `/entrar`, `/cadastro?papel=indicador|consultor&consultor=<id>`, `/painel/:papel` (placeholder).

Os dados de consultores ficam em `src/data/consultores.ts` (fictícios, fotos do Pexels). Login, cadastro e Gov.br ainda não têm backend.

> Mantenha esta pasta fora do Google Drive: o `npm install` falha dentro da pasta sincronizada.
