export interface SplitResult {
    tokens: string[];
    seps: string[];
}

export function split(str: string, seps: string): SplitResult {
    const tokens = [];
    const separators = [];
    let word = "";
    for(let i=0; i<str.length; i++) {
        const ch = str[i];
        const isSep = seps.indexOf(ch)!=-1;
        if(isSep) {
            tokens.push(word);
            separators.push(ch);
            word = "";
        }
        else {
            word += ch;
        }
    }

    if(word) {
        tokens.push(word);
    }

    return {
        tokens,
        seps: separators,
    }
}

function join(tokens, seps) {
    let res = "";

    for (let i = 0; i < tokens.length; i++) {
        res += tokens[i];

        if(i < tokens.length-1) {
            res += seps[i];
        }
    }

    return res;
}
