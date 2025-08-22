
// 簡易 HTTP クライアント（axios ラッパー）
class Http{
    constructor() {
    }
    get(uri){
        return new Promise((resolve, reject) => {
            // 絶対パスのときは API ベースパスを前置
            if (typeof uri === 'string' && uri.startsWith('/') && window.API_BASE) {
                uri = window.API_BASE + uri
            }
            axios.get(uri).then(response => {
                console.log(response);


                resolve(response.data)


            }).catch( (error) => {
                let {status,statusText} = error.response

                reject({status:status,statusText:statusText})

            });
        })
    }
    post(uri,param,config){

        return new Promise((resolve, reject)=>{
            // 絶対パスのときは API ベースパスを前置
            if (typeof uri === 'string' && uri.startsWith('/') && window.API_BASE) {
                uri = window.API_BASE + uri
            }
            axios.post(uri, param, config).then(response=>{
                console.log(response)

                resolve(response.data)
            }).catch( (error) => {
                console.log(error)
                let {status,statusText} = error.response

                reject({status:status,statusText:statusText})

            });


        })

    }
}

export {Http}
