/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'shared-no-internal-deps',
      comment: 'Shared module should not depend on any other internal modules',
      severity: 'error',
      from: {
        path: '^src/shared',
      },
      to: {
        path: '^src/',
        pathNot: [
          '^src/shared',
          '^src/config',
        ],
      },
    },
    {
      name: 'customs-no-refer-other-domains',
      comment: 'Customs module should not depend on any other domain modules',
      severity: 'error',
      from: {
        path: '^src/customs'
      },
      to: {
        path: '^src/',
        pathNot: [
          '^src/customs',
          '^src/shared',
          '^src/events',
          '^src/clients',
          '^src/constants',
          '^src/aws'
        ]
      }
    },
    {
      name: 'demo-no-refer-other-domains',
      comment: 'Demo module should not depend on any other domain modules',
      severity: 'error',
      from: {
        path: '^src/demo'
      },
      to: {
        path: '^src/',
        pathNot: [
          '^src/demo',
          '^src/shared',
          '^src/clients'
        ]
      }
    },
    {
      name: 'no-circular',
      comment: 'Circular dependencies are not allowed',
      severity: 'error',
      from: {},
      to: {
        circular: true,
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    exclude: {
      path: '(migrations|\.spec\.ts$)',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/(@[^/]+/[^/]+|[^/]+)',
      },
      archi: {
        collapsePattern: '^src/[^/]+',
      },
      text: {
        highlightFocused: true,
      },
    },
  },
};
