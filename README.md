# Design System - Attio

Sistema de design tokens e componentes.

## 🚀 Como testar

### Opção 1: Preview no Cursor
1. Abra `index.html` ou `components/button.html`
2. Pressione `Cmd+Shift+V` (Mac) ou `Ctrl+Shift+V` (Windows/Linux)
3. Ou clique com botão direito → "Open Preview"

### Opção 2: Servidor Local
O servidor já está rodando! Acesse:
- **Página inicial:** http://localhost:8000/index.html
- **Botões:** http://localhost:8000/components/button.html

Para iniciar o servidor manualmente:
```bash
cd /Users/0xfilipe/Documents/Attio
python3 -m http.server 8000
```

### Opção 3: Abrir diretamente no navegador
- Clique com botão direito no arquivo HTML → "Reveal in Finder" → Abra no navegador

## 📁 Estrutura do projeto

```
Attio/
├── tokens/
│   └── colors.css          # Tokens de cores (paletas + variáveis semânticas)
├── components/
│   ├── button.css           # Estilos dos botões
│   └── button.html          # Página de demonstração dos botões
├── index.html               # Página inicial
└── README.md                # Este arquivo
```

## 🎨 Componentes disponíveis

### Botões
- **6 variantes:** Primary, Secondary, Ghost, Destructive, Destructive Secondary, Placeholder
- **4 tamanhos:** 20px, 28px, 32px, 36px
- **4 estados:** Default, Hover, Focus, Disabled
- **Suporte a ícones:** À esquerda e à direita com gaps automáticos

## 🌓 Tema

A página inclui um toggle para alternar entre Light e Dark mode. O tema também detecta automaticamente a preferência do sistema.

## 📝 Tokens de cores

Todos os tokens estão definidos em `tokens/colors.css`:
- **12 paletas de cores** (amber, blue, green, cyan, lavender, lime, orange, pink, purple, red, yellow, grey)
- **Variáveis semânticas:** Surface, Button, Stroke, Content
- **Suporte completo a Light/Dark mode**
