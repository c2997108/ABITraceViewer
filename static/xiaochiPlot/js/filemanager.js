class FileManager {
    constructor() {
    }
    async openFile(OpenFilePickerOptions = {"multiple":false}){

        let accept = []
        console.log(OpenFilePickerOptions)
        if(OpenFilePickerOptions.types){
            OpenFilePickerOptions.types.forEach(t=>{
                for(let key in t.accept){
                    accept = accept.concat(t.accept[key])

                }
            })
        }




        // 古いブラウザ向け: input[type=file] を使ったフォールバック
        function oldOpen(){
            return new Promise((resolve, reject) => {
                let input = document.createElement("input")
                input.type = "file"
                if(OpenFilePickerOptions.multiple){
                    input.multiple = "multiple"
                }
                if(OpenFilePickerOptions.types){
                    input.accept = accept.join(",")
                }
                input.addEventListener("change", e => {
                    // Safari 対応（event.target が無いケースを考慮）
                    let fileList = e.target ? e.target.files : e.path[0].files
                    resolve(fileList)

                })


                input.click()
            })
        }


            // File System Access API が利用可能か判定
            if(window.showOpenFilePicker){
                console.log("File System Access API を使用します")
                let fileHandleList = await window.showOpenFilePicker(OpenFilePickerOptions);
                let fileList = []


                for(let i=0;i<fileHandleList.length;i++){
                    let file =  await fileHandleList[i].getFile()
                    fileList.push(file)
                }

                return fileList

            }
            else {
                return await oldOpen()
            }




    }
    saveBlobToFile(content,fileName){
        let reader = new FileReader();

        reader.readAsDataURL(content);
        reader.onload = function (e) {

            let el = document.createElement('a')
            // ダウンロードリンクの設定
            el.href = e.target.result
            el.download = fileName
            // クリックさせて保存を実行

            el.click()
        }
    }
    readExcel(file,multiSheet=false) {
        return new Promise((resolve, reject) => {
            let reader = new FileReader();
            reader.onload = function (e) {
                var data = e.target.result;
                let workbook = XLSX.read(data, {type: 'binary'});
                console.log("excel-book",workbook)
                let sheetDataArr = []
                workbook.SheetNames.forEach(sheetName=>{

                    let csvString = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName])

                    if(csvString.startsWith(",")){
                        // 先頭列が空（ID無記入）ケースの簡易補正
                        csvString = "sample_id" + csvString
                    }
                    // $2 は 2 番目の丸括弧の内容。空行・空列を削除
                    csvString = csvString.replace(/(,+)(\n)/g,"$2")
                    // 末尾の連続改行を削除
                    csvString = csvString.replace(/\n+$/g,"\n")

                    sheetDataArr.push({
                        sheetName:sheetName,
                        d3Data:d3.csvParse(csvString, d3.autoType)
                    })
                })



                multiSheet ? resolve(sheetDataArr) : resolve(sheetDataArr[0].d3Data)


            }
            reader.readAsBinaryString(file);
        })
    }
    creatD3Data(file) {
        console.log(file)
        let d3_file_reader = null
        let url = window.webkitURL.createObjectURL(file)





        switch (file.name.slice(file.name.lastIndexOf(".") + 1)) {
            case "tsv":
                d3_file_reader = d3.tsv(url, d3.autoType)
                break;
            case "csv":
                d3_file_reader = d3.csv(url, d3.autoType)
                break;
            case "json":
                d3_file_reader = d3.json(url)
                break;
            case "xlsx":
                d3_file_reader = this.readExcel(file)

                break;
            case "xls":
                // 旧形式の Excel
                d3_file_reader = this.readExcel(file)
                break;



            default:
                d3_file_reader = d3.text(url)

        }

        return d3_file_reader

    }

}

export {FileManager}
