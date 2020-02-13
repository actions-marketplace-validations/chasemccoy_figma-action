FROM node:10

LABEL com.github.actions.name="Export Figma slices"
LABEL com.github.actions.description="Export image assets from Figma to GitHub"
LABEL com.github.actions.icon="image"
LABEL com.github.actions.color="purple"

LABEL repository="http://github.com/chasemccoy/figma-action"
LABEL homepage="http://github.com/chasemccoy/figma-action"
LABEL maintainer="Chase McCoy <chasem000@gmail.com>"

WORKDIR /
COPY . /
RUN npm install

ENTRYPOINT [ "node", "/entrypoint.js" ]
