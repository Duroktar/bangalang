import { Environment } from '../interface/Runtime';
import { BangaPrintFunction, BangaImportFunction } from './RuntimeLibrary';
import { createEnvironment } from './Environment';


export const StdLib: Environment = createEnvironment();
StdLib.define('print', new BangaPrintFunction());
StdLib.define('import', new BangaImportFunction());
