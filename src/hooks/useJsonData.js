import { useEffect, useState } from "react";

export function useJsonData(url) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let alive = true;

        setLoading(true);

        fetch(url)
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`Failed to load ${url}`);
                }
                return res.json();
            })
            .then((json) => {
                if (alive) {
                    setData(json);
                    setLoading(false);
                }
            })
            .catch((err) => {
                if (alive) {
                    setError(err);
                    setLoading(false);
                }
            });

        return () => {
            alive = false;
        };
    }, [url]);

    return { data, loading, error };
}
