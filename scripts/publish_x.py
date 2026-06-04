import os
import sys
import argparse
import json
import tweepy
import re

# ✅ Função de validação de input (prevenção de command/prompt injection)
def validate_tweet_text(text):
    """Validar texto do tweet para prevenir injection attacks"""
    if not text or len(text) == 0:
        raise ValueError("Tweet não pode estar vazio")

    # Máximo 280 caracteres (limite do Twitter)
    if len(text) > 280:
        raise ValueError("Tweet muito longo (máximo 280 caracteres)")

    # Detectar null bytes
    if '\0' in text:
        raise ValueError("Null bytes não são permitidos")

    # Detectar caracteres de controle perigosos
    # Permitir apenas: \n, \t, \r (formatação normal)
    dangerous_pattern = r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]'
    if re.search(dangerous_pattern, text):
        raise ValueError("Caracteres de controle não são permitidos")

    return text

def validate_image_path(image_path):
    """Validar caminho de arquivo para prevenir path traversal"""
    if not image_path or not isinstance(image_path, str):
        raise ValueError("Caminho de arquivo inválido")

    # Prevenir path traversal
    normalized = image_path.replace('..', '')
    if normalized != image_path:
        raise ValueError("Path traversal detectado")

    # Apenas extensões de imagem permitidas
    allowed_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.webp')
    if not image_path.lower().endswith(allowed_extensions):
        raise ValueError("Tipo de arquivo não permitido. Use: PNG, JPG, GIF, WEBP")

    return image_path

def publish_tweet(text, image_path=None):
    try:
        # ✅ Validar input de texto ANTES de processar
        text = validate_tweet_text(text)

        # Recuperar credenciais do ambiente
        consumer_key = os.environ.get('TWITTER_CONSUMER_KEY')
        consumer_secret = os.environ.get('TWITTER_CONSUMER_SECRET')
        access_token = os.environ.get('TWITTER_ACCESS_TOKEN')
        access_token_secret = os.environ.get('TWITTER_ACCESS_TOKEN_SECRET')

        # Verificar se as chaves existem
        if not all([consumer_key, consumer_secret, access_token, access_token_secret]):
            result = {
                "success": False,
                "error": "Credenciais do Twitter/X incompletas nas variáveis de ambiente."
            }
            print(json.dumps(result))
            sys.exit(1)

        try:
            # 1. Autenticação API v1.1 (Necessária para Upload de Mídia)
            auth = tweepy.OAuth1UserHandler(
                consumer_key, consumer_secret, access_token, access_token_secret
            )
            api_v1 = tweepy.API(auth)

            # 2. Autenticação API v2 (Para criação do Tweet)
            client_v2 = tweepy.Client(
                consumer_key=consumer_key,
                consumer_secret=consumer_secret,
                access_token=access_token,
                access_token_secret=access_token_secret
            )

            media_ids = []

            # Se houver imagem, realizar upload via v1.1
            if image_path and os.path.exists(image_path):
                try:
                    # ✅ Validar caminho da imagem antes de usar
                    image_path = validate_image_path(image_path)

                    # Upload do arquivo
                    media = api_v1.media_upload(filename=image_path)
                    media_ids.append(media.media_id)
                except ValueError as val_err:
                    # Validação de caminho falhou
                    sys.stderr.write(f"Erro de validação: {str(val_err)}\n")
                    # Continuar sem imagem ao invés de falhar
                except Exception as upload_err:
                    # Se falhar o upload da imagem, tentamos postar apenas texto
                    # Mas reportamos o erro no log
                    sys.stderr.write(f"Aviso: Falha ao fazer upload da imagem: {str(upload_err)}\n")

            # 3. Postar Tweet via API v2
            if media_ids:
                response = client_v2.create_tweet(text=text, media_ids=media_ids)
            else:
                response = client_v2.create_tweet(text=text)

            tweet_id = response.data.get('id')
            result = {
                "success": True,
                "tweetId": tweet_id,
                "message": f"Tweet publicado com sucesso! ID: {tweet_id}"
            }
            print(json.dumps(result))
            sys.exit(0)

        except Exception as e:
            result = {
                "success": False,
                "error": f"Erro durante a execução do Tweepy: {str(e)}"
            }
            print(json.dumps(result))
            sys.exit(1)

    except ValueError as validation_error:
        # ✅ Erro de validação de input
        result = {
            "success": False,
            "error": f"Validação de entrada falhou: {str(validation_error)}"
        }
        print(json.dumps(result))
        sys.exit(1)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Publicador de Tweets do JojoBot")
    parser.add_argument('--text', required=True, help="Texto do Tweet")
    parser.add_argument('--image', required=False, default=None, help="Caminho local da imagem opcional")
    
    args = parser.parse_args()
    publish_tweet(args.text, args.image)
