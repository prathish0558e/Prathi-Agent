const getHashSections = (hash: string) => {
  const normalizedHash = hash.startsWith('#') ? hash.slice(1) : hash;

  if (!normalizedHash) {
    return {
      routePath: '',
      routeParams: new URLSearchParams(),
      fragmentParams: new URLSearchParams(),
    };
  }

  if (normalizedHash.startsWith('/')) {
    const [pathAndQuery, fragment = ''] = normalizedHash.split('#', 2);
    const [routePath, routeQuery = ''] = pathAndQuery.split('?', 2);

    return {
      routePath,
      routeParams: new URLSearchParams(routeQuery),
      fragmentParams: new URLSearchParams(fragment),
    };
  }

  return {
    routePath: '',
    routeParams: new URLSearchParams(),
    fragmentParams: new URLSearchParams(normalizedHash),
  };
};

const firstDefinedValue = (...values: Array<string | null>) => values.find((value) => Boolean(value)) ?? null;

export const getOAuthCallbackParams = (href: string = window.location.href) => {
  const url = new URL(href);
  const searchParams = url.searchParams;
  const { routePath, routeParams, fragmentParams } = getHashSections(url.hash);

  const code = firstDefinedValue(searchParams.get('code'), routeParams.get('code'), fragmentParams.get('code'));
  const accessToken = firstDefinedValue(
    searchParams.get('access_token'),
    routeParams.get('access_token'),
    fragmentParams.get('access_token'),
  );
  const refreshToken = firstDefinedValue(
    searchParams.get('refresh_token'),
    routeParams.get('refresh_token'),
    fragmentParams.get('refresh_token'),
  );
  const error = firstDefinedValue(searchParams.get('error'), routeParams.get('error'), fragmentParams.get('error'));
  const errorDescription = firstDefinedValue(
    searchParams.get('error_description'),
    routeParams.get('error_description'),
    fragmentParams.get('error_description'),
  );

  return {
    code,
    accessToken,
    refreshToken,
    error,
    errorDescription,
    routePath,
    isCallbackRoute: routePath.startsWith('/auth/callback'),
    hasAuthSignal: Boolean(code || accessToken || refreshToken || error || errorDescription),
  };
};