/** Algoritmos de ejemplo para arrancar (sandbox + demos). */
import {
	assign, read, write, iff, whilst, forr,
	v, num, bin, type Program
} from './ast';

export interface Sample {
	key: string;
	title: string;
	/** entradas sugeridas (stdin) para correrlo. */
	input: string;
	build: () => Program;
}

export const SAMPLES: Sample[] = [
	{
		key: 'suma',
		title: 'Suma de dos números',
		input: '7 5',
		build: () => ({
			name: 'Suma',
			body: [
				read('a', 'b'),
				assign('s', bin('+', v('a'), v('b'))),
				write(v('s'))
			]
		})
	},
	{
		key: 'contar',
		title: 'Contar de 1 a N',
		input: '5',
		build: () => ({
			name: 'Contar',
			body: [
				read('n'),
				forr('i', num(1), v('n'), [write(v('i'))])
			]
		})
	},
	{
		key: 'paridad',
		title: '¿Par o impar?',
		input: '8',
		build: () => ({
			name: 'Paridad',
			body: [
				read('n'),
				iff(
					bin('==', bin('%', v('n'), num(2)), num(0)),
					[write(num(0))], // 0 = par (placeholder; el alumno cambiaría a texto)
					[write(num(1))]
				)
			]
		})
	},
	{
		key: 'factorial',
		title: 'Factorial con mientras',
		input: '5',
		build: () => ({
			name: 'Factorial',
			body: [
				read('n'),
				assign('f', num(1)),
				assign('i', num(1)),
				whilst(bin('<=', v('i'), v('n')), [
					assign('f', bin('*', v('f'), v('i'))),
					assign('i', bin('+', v('i'), num(1)))
				]),
				write(v('f'))
			]
		})
	}
];

export const defaultProgram = (): Program => SAMPLES[0].build();
