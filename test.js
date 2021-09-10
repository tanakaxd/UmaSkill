// ["ID","スキル名","取得pt(コツ0)","査定値","持続時間補正値","補正値"]
//　査定効率、チムレスコア効率(レアスキルかどうかという情報が必要)、効果量効率（速度スキルのみ）
//上位と下位でヒントレベルが違う場合があるので、効率を一括して計算することはできない
//おそらく理想的には上位スキルの差分を計算して新規レコードとして作るべき？
//指数の偏差値化
//脚質距離限定スキルの査定値補正

//オプション　脚質距離補正を含めるかどうか。ヒントレベル。よく使うスキル。サポカからの入手できるスキル。
// 表示する列の選択
// レコードに表示するかどうか、ヒントレベルの切り替えという項目を作る

const table = [];

window.onload = () => {

    loadData("skill_effectiveness.json");

    const promises = [];
    
    promises.push(loadData("skill_effectiveness.json"));
    promises.push(loadData("skill_pt_hint.json"));

    Promise.all(promises)
        .then((results) => {
            // console.log(results[0]);
            results[0].forEach((record) => {
                const entry = {};
                Object.keys(record).forEach((col) => {
                    entry[col] = record[col];
                });
                table.push(entry);
            });
            // console.log(results[1]);

            results[1].forEach((record) => {
                for (const row of table) {
                    if (row["ID"]==record["ID"]) {
                        Object.keys(record).forEach((col) => {
                            row[col] = record[col];
                        });
                        // break;
                    }
                }
            });
        })
        .then(() => {
            console.log(table);
            //上位スキルのPT修正
            for (let index = 0; index < table.length; index++) {
                const record = table[index];
                if (record["査定値(上位スキル単独査定)"] != "-") {
                    record["取得pt(コツ0)"] += table[index + 1]["取得pt(コツ0)"];
                    //TODO スキル差分を作る    
                }
            }

            makeTable(table, "body",["ID","スキル名","取得pt(コツ0)","査定値","持続時間補正値","補正値"]);
        })
        .catch(err => { console.log(err) });
}

async function loadData(url) {
    let response = await fetch(url);
    let json = await response.json();
    return json;
}

// 表の動的作成
function makeTable(table_data, tableId, cols_name){
    const rows = [];
    const table_dom = document.createElement("table");
    const retreived_table = [];




    //必要列の抽出
    table_data.forEach((record) => {
        const row = {};
        cols_name.forEach((key) => {
            row[key] = record[key];
        });
 
        //計算列の追加
        const temp = record["査定値"] / record["取得pt(コツ0)"];
        row["査定効率指数"] = Math.round(temp * 100) / 100;//TODO ◎スキルの仕様
        const score = record["査定値(上位スキル単独査定)"] == "-" ? 500 : record["スキル名"].endsWith("◎") ? 500 : 1200;
        row["チムレスコア効率指数"] = Math.round(score / record["取得pt(コツ0)"] * 100) / 100 ;
        const effectiveness = record["種類"] == "目標速度アップ"?record["補正値"] * record["持続時間補正値"]/ 10000/10000 :NaN;
        row["効果量(m)"] = effectiveness;
        row["効果量効率指数"] = Math.round(effectiveness/record["取得pt(コツ0)"] * 10000) ;

        retreived_table.push(row);
    });


    //並べ替え
    // console.log(retreived_table[1]["チムレスコア効率指数"]);
    sortOnCol(retreived_table, "査定効率指数",false);
    // sortOnCol(retreived_table, "チムレスコア効率指数",false);
    // sortOnCol(retreived_table, "効果量効率指数",false);
    // sortOnCol(retreived_table, "効果量(m)",false);

    // retreived_table.sort((a, b) => a["ID"] - b["ID"]);
    // console.log(retreived_table.sort((a, b) => a["チムレスコア効率指数"] - b["チムレスコア効率指数"]));
    console.log(retreived_table);


    //header
    rows.push(table_dom.insertRow(-1));
    Object.keys(retreived_table[0]).forEach((col_label) => { //TODO index0の行が欠けていた場合バグ
        const cell = rows[0].insertCell(-1);
        cell.appendChild(document.createTextNode(col_label));
        cell.style.backgroundColor = "#bbb"; 
    });


    for(i = 0; i < retreived_table.length; i++){
        rows.push(table_dom.insertRow(-1));  // 行の追加

        Object.keys(retreived_table[i]).forEach((key) => {
            const cell = rows[i+1].insertCell(-1);
            cell.appendChild(document.createTextNode(retreived_table[i][key]));
            cell.style.backgroundColor = "#ddd"; // ヘッダ行以外
        });
    }
    // 指定したdiv要素に表を加える
    document.getElementById(tableId).appendChild(table_dom);
}

function sortOnCol(table, col_label, ascending) {//数字しかソートできない
    table.removeIf(x => Number.isNaN(x[col_label]));
    table.sort((a, b) => ascending? a[col_label] - b[col_label]:b[col_label] - a[col_label]);
}

Array.prototype.removeIf = function(callback) {
    var i = this.length;
    while (i--) {
        if (callback(this[i])) {//callback(this[i], i)となっていたが、おそらくpredicateにindex情報も渡せるような設計
            this.splice(i, 1);
        }
    }
};