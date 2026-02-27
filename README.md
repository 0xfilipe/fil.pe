# fil.pe - Site Pessoal do Filipe

Um site pessoal moderno e responsivo construído com HTML5, CSS3 e JavaScript vanilla.

## 🚀 Características

- **Design Responsivo**: Funciona perfeitamente em dispositivos móveis, tablets e desktops
- **Performance Otimizada**: CSS e JavaScript otimizados para carregamento rápido
- **Acessibilidade**: Seguindo as melhores práticas de acessibilidade web
- **SEO Friendly**: Meta tags otimizadas para mecanismos de busca
- **Animações Suaves**: Animações CSS e JavaScript respeitando `prefers-reduced-motion`
- **Formulário Funcional**: Sistema de contato com validação
- **Menu Mobile**: Navegação responsiva com hamburger menu

## 🎨 Design

- **Paleta de Cores**: Sistema de cores moderno com variáveis CSS
- **Tipografia**: Fonte Inter do Google Fonts
- **Layout**: Grid CSS e Flexbox para layouts responsivos
- **Componentes**: Cards, botões e formulários com design consistente

## 🛠️ Tecnologias Utilizadas

- **HTML5**: Estrutura semântica
- **CSS3**: Estilização moderna com variáveis CSS, Grid e Flexbox
- **JavaScript ES6+**: Interatividade e funcionalidades dinâmicas
- **Google Fonts**: Tipografia profissional

## 📁 Estrutura do Projeto

```
fil.pe/
├── index.html          # Página principal
├── styles.css          # Estilos CSS
├── script.js           # JavaScript
├── README.md           # Documentação
└── .gitignore         # Arquivos ignorados pelo Git
```

## 🔧 Configuração e Desenvolvimento

### Pré-requisitos

- Servidor web local (opcional, mas recomendado para desenvolvimento)
- Browser moderno com suporte a ES6+

### Executando Localmente

1. **Clone ou baixe o projeto**
   ```bash
   git clone <repository-url>
   cd fil.pe
   ```

2. **Serve os arquivos**
   
   **Opção 1: Python (Python 3)**
   ```bash
   python -m http.server 8000
   ```
   
   **Opção 2: Node.js**
   ```bash
   npx serve .
   ```
   
   **Opção 3: PHP**
   ```bash
   php -S localhost:8000
   ```

3. **Acesse no browser**
   ```
   http://localhost:8000
   ```

## 📱 Compatibilidade

- **Browsers Suportados**: Chrome 60+, Firefox 55+, Safari 12+, Edge 79+
- **Dispositivos**: Smartphones, tablets, desktops
- **Resolução**: 320px+ (mobile first)

## ⚡ Performance

- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **First Input Delay**: < 100ms

## 🔒 Segurança

- **Content Security Policy**: Implementada via meta tags
- **HTTPS Ready**: Preparado para servir via HTTPS
- **Form Validation**: Validação client-side e server-side ready

## 📈 SEO

- **Meta Tags**: Título, descrição e keywords otimizadas
- **Open Graph**: Otimizado para compartilhamento em redes sociais
- **Twitter Cards**: Metadados para Twitter
- **Schema.org**: Marcação estruturada (ready para implementação)

## 🎯 Funcionalidades

### Navegação
- Menu responsivo com animações
- Scroll suave entre seções
- Indicadores visuais de seção ativa

### Seções
- **Hero**: Apresentação principal com call-to-actions
- **Sobre**: Informações pessoais e habilidades
- **Trabalhos**: Portfolio de projetos
- **Contato**: Formulário e informações de contato

### Interatividade
- Formulário de contato com validação
- Animações on-scroll
- Feedback visual para ações do usuário
- Estados de hover e focus

## 🚀 Deploy

### Netlify
1. Conecte seu repositório Git
2. Configure build settings (não necessário para este projeto)
3. Deploy automático

### Vercel
```bash
npx vercel --prod
```

### GitHub Pages
1. Faça push para um repositório GitHub
2. Vá em Settings > Pages
3. Selecione a branch main

### Servidor Tradicional
1. Faça upload dos arquivos via FTP
2. Configure o domínio fil.pe
3. Configure certificado SSL

## 🔄 Atualizações Futuras

- [ ] PWA (Progressive Web App)
- [ ] Blog integrado
- [ ] Modo escuro
- [ ] Internacionalização (i18n)
- [ ] Analytics integration
- [ ] CMS headless integration

## 📞 Contato

- **Email**: hello@fil.pe
- **LinkedIn**: [linkedin.com/in/filipe](https://linkedin.com/in/filipe)
- **GitHub**: [github.com/filipe](https://github.com/filipe)

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

---

**Feito com ❤️ e muito café por Filipe**