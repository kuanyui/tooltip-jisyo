.PHONY: dev build xpi xpi-server clear zip-repo

NAME=Tooltip Jisyo
BIN:="node_modules/.bin"
XPI_DIR=../xpi
XPI_PATH="${XPI_DIR}/${NAME}.xpi"
ZIP_PATH="../${NAME}-upload.zip"

watch: clear
	./node_modules/.bin/webpack --mode=development --watch

build: clear
	./node_modules/.bin/webpack --mode=production

xpi: clear build
	mkdir -p ${XPI_DIR}
	rm -f ${XPI_PATH}
	zip -r -FS ${XPI_PATH} dist/ img/ manifest.json README.org

xpi-server: clear xpi
	ifconfig | grep "inet " | grep --invert-match '127.0.0.1'
	cd ${XPI_DIR}; python3 -m http.server 8888

clear:
	rm -rf dist/*

zip-repo: clear
	rm -f ${ZIP_PATH}
	zip -r ${ZIP_PATH} . -x .git/\* node_modules/\*

