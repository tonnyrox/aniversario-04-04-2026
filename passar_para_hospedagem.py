import os
import zipfile

# --- CONFIGURAÇÃO ---
PASTA_DO_PROJETO = r"D:\Projetos\Aniversario\aniversario-programa"
NOME_DO_ZIP = "deploy_aniversario.zip"

# Arquivos que o script vai ignorar para o ZIP não dar erro no servidor
IGNORAR = ['node_modules', '.git', '.vscode', '__pycache__', 'preparar_envio.py']

def preparar_pacote():
    # Caminho da sua Área de Trabalho
    desktop = os.path.join(os.path.join(os.environ['USERPROFILE']), 'Desktop')
    caminho_zip = os.path.join(desktop, NOME_DO_ZIP)

    print(f"🔍 Coletando arquivos em: {PASTA_DO_PROJETO}")
    
    with zipfile.ZipFile(caminho_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for raiz, pastas, arquivos in os.walk(PASTA_DO_PROJETO):
            # Ignora pastas desnecessárias
            pastas[:] = [d for d in pastas if d not in IGNORAR]
            
            for arquivo in arquivos:
                if arquivo not in IGNORAR and not arquivo.endswith('.zip'):
                    caminho_completo = os.path.join(raiz, arquivo)
                    # Mantém a estrutura de pastas interna (como a pasta 'img')
                    caminho_relativo = os.path.relpath(caminho_completo, PASTA_DO_PROJETO)
                    
                    zipf.write(caminho_completo, caminho_relativo)
                    print(f"  📦 Adicionado: {caminho_relativo}")

    print(f"\n✅ ZIP CRIADO COM SUCESSO!")
    print(f"📍 Local: {caminho_zip}")
    print("\n--- PRÓXIMOS PASSOS NO CPANEL ---")
    print(f"1. Suba esse ZIP para a pasta 'aniversario.sahe.com.br' e extraia.")
    print("2. No 'Setup Node.js App', clique no botão azul 'RUN NPM INSTALL'.")
    print("3. Clique em 'RESTART'.")

if __name__ == "__main__":
    if os.path.exists(PASTA_DO_PROJETO):
        preparar_pacote()
    else:
        print("❌ Erro: Pasta do projeto não encontrada. Verifique o caminho!")