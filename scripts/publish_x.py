import os
import sys
import argparse
import json
import tweepy

def publish_tweet(text, image_path=None):
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
                # Upload do arquivo
                media = api_v1.media_upload(filename=image_path)
                media_ids.append(media.media_id)
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

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Publicador de Tweets do JojoBot")
    parser.add_argument('--text', required=True, help="Texto do Tweet")
    parser.add_argument('--image', required=False, default=None, help="Caminho local da imagem opcional")
    
    args = parser.parse_args()
    publish_tweet(args.text, args.image)
