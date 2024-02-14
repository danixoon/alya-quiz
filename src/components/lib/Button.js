import clsx from 'clsx';

const Button = ({ className, size = 'md', children, ...rest }) => {
  const styleBySize = {
    sm: 'h-8 px-2 text-sm',
    md: 'h-12 px-3 text-md',
    lg: 'h-16 px-6 text-lg',
  };

  return (
    <button
      {...rest}
      className={clsx(
        className,
        'border font-display border-gray-400 rounded-lg shadow-lg hover:scale-110 transition-transform ease-out-expo duration-200 active:scale-90',
        styleBySize[size],
      )}
    >
      {children}
    </button>
  );
};

export default Button;
