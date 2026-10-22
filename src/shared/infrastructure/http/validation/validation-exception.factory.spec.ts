import { validationExceptionFactory } from './validation-exception.factory';

describe('validationExceptionFactory', () => {
  it('groups constraint messages by field and preserves nested paths', () => {
    const exception = validationExceptionFactory([
      {
        property: 'page',
        constraints: { isInt: 'Must be an integer.', min: 'Must be positive.' },
      },
      {
        property: 'filter',
        children: [
          { property: 'text', constraints: { isString: 'Must be a string.' } },
        ],
      },
    ]);

    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toEqual({
      errors: [
        {
          field: 'page',
          messages: ['Must be an integer.', 'Must be positive.'],
        },
        { field: 'filter.text', messages: ['Must be a string.'] },
      ],
    });
  });
});
