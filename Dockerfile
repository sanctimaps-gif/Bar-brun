# Le Café Brun — image du site et de son espace d'administration.
# Aucune dépendance à installer : le serveur n'utilise que Node.

FROM node:22-alpine

WORKDIR /app
COPY . .
RUN chmod +x /app/serveur/entree-docker.sh

# Le contenu et les comptes vivent hors du code, sur un volume : sans cela,
# les modifications faites depuis l'espace « Compte » disparaîtraient au
# premier redémarrage.
ENV CAFE_BRUN_DATA=/data \
    CAFE_BRUN_COMPTES=/data/comptes.json \
    PORT=8000 \
    COOKIE_SECURE=1

VOLUME ["/data"]
EXPOSE 8000

CMD ["/app/serveur/entree-docker.sh"]
