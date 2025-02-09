import cors from "cors";
import csv from 'csv-parser';
import express from 'express';
import fs from 'fs';
import multer from 'multer';
import { generateNumericUUID } from './app/helper/uniqueId.js';
import axios from 'axios';
import { prisma } from "./prisma/index.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.single('file'), async (req, res) => {
  const results = [];
  const filePath = req.file.path;

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      fs.unlinkSync(filePath); // Clean up the uploaded file

      const apiEndpoint = 'https://moneywale.in/api/v1/dmt';
      const headers = {
        'username': '7383606576',
        'password': '751613',
        'Content-Type': 'application/json',
        'Authorization': 'Basic NzM4MzYwNjU3Njo3NTE2MTM='
      };

      const responses = [];

      for (const row of results) {
        const numericUUID = generateNumericUUID();

        const data = {
          customerId: Number(numericUUID),
          name: 'Zack',
          accountNo: row['Destination Account Number'],
          ifsc: row['Destination Bank Routing Code'],
          mobileNo: 9725545067,
          recipientName: row['Beneficiary Name'],
          amount: Number(row['Amount']),
          clientRefId: `IND${numericUUID}`,
          mode: row['Payment Type']
        };
        try {
          const response = await axios.post(apiEndpoint, data, {
            headers: headers,
            maxBodyLength: Infinity
          });
          // Store data in MongoDB for successful responses
          try {
            const fileData = await prisma.fileUserData.create({
              data: {
                beneficiaryName: data.recipientName,
                destinationBank: data.accountNo,
                destinationAccountNumber: data.accountNo,
                destinationBankIfsc: data.ifsc,
                amount: data.amount,
                currency: 'INR',
                response: response.data,
                mode: row['Payment Type']
              }
            });
            console.log("Stored in MongoDB:", fileData);
          } catch (error) {
            console.error("Error storing in MongoDB:", error);
          }

          responses.push({ success: true, data: response.data });
        } catch (error) {
          // Store data in MongoDB for unsuccessful responses
          try {
            const fileData = await prisma.fileUserData.create({
              data: {
                beneficiaryName: data.recipientName,
                destinationBank: data.accountNo,
                destinationAccountNumber: data.accountNo,
                destinationBankIfsc: data.ifsc,
                amount: data.amount,
                currency: 'INR',
                response: error?.response?.data || error.message, // Store error message or response data
                mode: row['Payment Type']
              }
            });
            console.log("Stored error in MongoDB:", fileData);
          } catch (dbError) {
            console.error("Error storing error in MongoDB:", dbError);
          }

          responses.push({
            success: false,
            error: error?.response?.data?.message || error.message
          });
        }
      }

      res.json({
        message: 'File processed and data sent to API.',
        responses: responses
      });
    });
});

app.get('/get-res', async (req, res) => {
  try {
    const getRes = await prisma.fileUserData.findMany()
    res.send(getRes)
  } catch (error) {
  }
})



app.get('/get-res-pending', async (req, res) => {
  try {
    const pendingResponses = await prisma.fileUserData.findMany({
      select: {
        response: true,
        amount:true
      }

    });
    console.log(pendingResponses);
    const pendingResponsesFiltered = pendingResponses.filter(entry => (
      entry.response.status === "PENDING" && entry.response.ref_id
    ));

    console.log("Pending Responses with ref_id:", pendingResponsesFiltered);
    res.send(pendingResponsesFiltered)

  } catch (error) {
  }
})

// app.get('/get-res-success', async (req, res) => {
//   try {
//     const pendingResponses = await prisma.fileUserData.findMany({
//       select: {
//         response: true,
//         amount:true
//       }
      
//     });
//     console.log(pendingResponses);
//     const pendingResponsesFiltered = pendingResponses.filter(entry => (
//       entry.response.status === "SUCCESS" 
//     ));

//     console.log("Pending Responses with ref_id:", pendingResponsesFiltered);
//     res.send(pendingResponsesFiltered)

//   } catch (error) {
//   }
// })


app.get('/get-res-success-pending', async (req, res) => {
  try {
    const pendingResponses = await prisma.fileUserData.findMany({
      select: {
        response: true,
        amount: true
      }
    });

    console.log(pendingResponses);
    const pendingResponsesFiltered = pendingResponses.filter(entry => (
      entry.response.status === "SUCCESS" || entry.response.status === "PENDING"
    ));

    console.log("Pending Responses with ref_id:", pendingResponsesFiltered);

    const totalAmount = pendingResponsesFiltered.reduce((sum, entry) => sum + entry.amount, 0);

    console.log("Total Amount   totalAmount 20984:", totalAmount);

    res.send({
      data: pendingResponsesFiltered,
      totalAmount
    });

  } catch (error) {
    res.status(500).send({ error: 'Internal Server Error' });
  }
});


const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
