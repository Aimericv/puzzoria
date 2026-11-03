import {readFileSync,statSync} from "node:fs";
import {quizAcquisitionReport} from "../src/lib/quiz-acquisition";
const args=process.argv.slice(2);
if(args.length!==4||args[0]!=="--google"||args[2]!=="--analytics")throw Error("Usage: node --import tsx scripts/report-quiz-acquisition.ts --google search-console.json --analytics puzzoria-analytics.json");
function read(path:string){if(statSync(path).size>8*1024*1024)throw Error("Aggregate report too large");return JSON.parse(readFileSync(path,"utf8"));}
console.log(JSON.stringify(quizAcquisitionReport(read(args[1]),read(args[3])),null,2));
