import * as models from '../models';

// TODO: Recusively crawl all like the templating logic.
//
// Parse the fields for patterns that match a possible previous request
// that this request will depend on.
export const getRequestDependencyIds = request => {
  const fieldsToCheck = [
    request.body && request.body.text,
    request.url,
    ...request.headers.map(h => h.value)
  ];

  function extractTags(text) {
    if (!text) {
      return [];
    }

    // Assume no nested tags.
    const OPEN_DELIM = '{%';
    const CLOSE_DELIM = '%}';
    const tags = [];
    let start = -1;
    for (let i = 0; i < text.length; ++i) {
      const view = text.substring(i, i + 2);
      if (view === OPEN_DELIM) {
        start = i;
      } else if (view === CLOSE_DELIM) {
        const end = i + 2;
        tags.push(text.substring(start, end));
        start = -1;
      }
    }
    return tags;
  }

  const tags = fieldsToCheck.map(extractTags).reduce((a, b) => a.concat(b), []);
  return tags
    .map(tag => {
      const match = tag.match(/req_[a-f0-9]+/);
      return match && match[0];
    })
    .filter(v => !!v);
};

export const delay = async duration => {
  return new Promise(resolve => setTimeout(() => resolve(), duration));
};

export async function findEnvironmentsByName(rootId, name) {
  const environments = await models.environment.findByParentId(rootId);
  const matched = await Promise.all(
    environments.map(async env => {
      let found = [];
      if (env.name === name) {
        found = found.concat([env]);
      }
      found = found.concat(await findEnvironmentsByName(env._id, name));
      return found;
    })
  );
  return matched.reduce((acc, envs) => {
    return acc.concat(envs);
  }, []);
}
