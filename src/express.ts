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
    return async function(req, res, next) {
        try {
            const retVal = await func.call(this, req, res, next);
            res.send(retVal);
        }
        catch (err) {
            next(err);
        }
    }
}

