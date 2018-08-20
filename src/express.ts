export class HttpError extends Error {
    constructor(message: string, public statusCode: number, public statusMessage?: string, public body?: any) {
        super(message);
    }
}

function onError(res, err) {
    console.error(err);

    if(err instanceof HttpError) {
        res.status(err.statusCode);
        res.statusMessage = res.statusMessage;
        res.json({
            ok: false,
            message: err.message,
        });

        return;
    }

    res.status(500);

    res.json({
        ok: false,
        message: err.message,
    });
}

export function promisifyExpressApi(func) {
    return function(req, res) {
        async function run(that, args): Promise<void> {
            try {
                const retVal = await func.apply(that, args);
                res.send(retVal);
            }
            catch (err) {
                onError(res, err);
            }
        }

        return run(this, arguments);
    }
}

