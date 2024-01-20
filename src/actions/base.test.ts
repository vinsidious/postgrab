import _ from 'lodash';
import moment from 'moment-timezone';

import PostgrabBaseClass from './base';

describe(`PostgrabBaseClass`, () => {
  let base;

  beforeEach(() => {
    class Base extends PostgrabBaseClass {
      async run() {}
    }
    base = Base.prototype;
    base.pool = {
      local: {
        query: async () => {},
      },
      remote: {
        query: async () => {},
      },
    };
  });

  describe(`testConnections`, () => {
    beforeEach(() => {
      base.query.local = jest.fn().mockReturnValue(1);
      base.query.remote = jest.fn().mockReturnValue(1);
      base.status = {
        start: jest.fn(),
        fail: jest.fn(),
        succeed: jest.fn(),
      };
      jest.useFakeTimers();
    });

    function timeBomb() {
      base.testConnections();
      jest.runTimersToTime(15000);
    }

    it(`blows up if the local connection times out`, () => {
      base.query.local = () => new Promise(resolve => setTimeout(resolve, 20000));
      expect(timeBomb).toThrow;
    });

    it(`blows up if the remote connection times out`, () => {
      base.query.remote = () => new Promise(resolve => setTimeout(resolve, 20000));
      expect(timeBomb).toThrow;
    });

    it(`blows up if the local connection throws`, () => {
      base.query.local = () => {
        throw new Error();
      };
      expect(timeBomb).toThrow;
    });

    it(`blows up if the remote connection throws`, () => {
      base.query.remote = () => {
        throw new Error();
      };
      expect(timeBomb).toThrow;
    });

    it(`succeeds if both the local/remote connections succeed`, () => {
      base.query.local = async () => 1;
      base.query.remote = async () => 1;
      expect(timeBomb).not.toThrow;
    });
  });

  describe(`getRemoteWhereClauseForTable`, () => {
    let table, partial, bookmark, localMax;

    async function getRemoteWhereClauseForTable() {
      return await base.getRemoteWhereClauseForTable(table);
    }

    beforeEach(() => {
      base.getLocalMaxForTable = async () => localMax;
      base.config = { bookmarks: {}, partials: {} };
      table = `table1`;
      partial = `WHERE foo_bar = 'baz'`;
      bookmark = `row_num`;
      localMax = 10;
    });

    describe(`with a partial and a bookmark column`, () => {
      it(`returns the correct clause`, async () => {
        base.config.bookmarks[table] = bookmark;
        base.config.partials[table] = partial;
        const remoteWhereClause = await getRemoteWhereClauseForTable();
        expect(remoteWhereClause).toBe(`${partial} AND ${bookmark} > ${localMax}`);
      });

      it(`quotes the local max if it's a timestamp`, async () => {
        localMax = moment().toISOString();
        base.config.bookmarks[table] = bookmark;
        base.config.partials[table] = partial;
        const remoteWhereClause = await getRemoteWhereClauseForTable();
        expect(remoteWhereClause).toBe(`${partial} AND ${bookmark} > '${localMax}'`);
      });
    });

    describe(`with no partial but with a bookmark column`, () => {
      it(`returns the correct clause`, async () => {
        base.config.bookmarks[table] = bookmark;
        base.config.partials[table] = null;
        const remoteWhereClause = await getRemoteWhereClauseForTable();
        expect(remoteWhereClause).toBe(`WHERE ${bookmark} > ${localMax}`);
      });
    });

    describe(`with a partial but no bookmark column`, () => {
      it(`returns the correct clause`, async () => {
        base.config.bookmarks[table] = null;
        base.config.partials[table] = partial;
        const remoteWhereClause = await getRemoteWhereClauseForTable();
        expect(remoteWhereClause).toBe(partial);
      });
    });

    describe(`with no partial and no bookmark column`, () => {
      it(`returns the correct clause`, async () => {
        base.config.bookmarks[table] = null;
        base.config.partials[table] = null;
        const remoteWhereClause = await getRemoteWhereClauseForTable();
        expect(remoteWhereClause).toBe(``);
      });
    });
  });

  describe(`getLocalMaxForTable`, () => {
    const table = `table1`;
    const bookmark = `foo`;

    async function getLocalMaxForTable() {
      return await base.getLocalMaxForTable(table);
    }

    beforeEach(() => {
      base.config = {
        schema: `public`,
        bookmarks: {
          [table]: bookmark,
        },
      };
      base.tables = {
        [table]: {
          columns: [
            {
              name: bookmark,
              type: `timestamp with time zone`,
            },
          ],
        },
      };
    });

    it(`returns an integer if it's an integer type column`, async () => {
      base.tables[table].columns[0].type = `integer`;
      const max = await getLocalMaxForTable();
      expect(typeof max).toBe(`number`);
    });

    it(`returns a string if it's a date/time type column`, async () => {
      base.query.local = async () => moment().toISOString();
      base.tables[table].columns[0].type = `timestamp with time zone`;
      const max = await getLocalMaxForTable();
      expect(typeof max).toBe(`string`);
    });
  });
});
