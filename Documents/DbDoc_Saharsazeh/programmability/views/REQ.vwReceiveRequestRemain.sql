
-------------------------------------
CREATE   view REQ.vwReceiveRequestRemain
--WITH ENCRYPTION
as

	select r.ReceiveRequestID,
	       r.Amount -
		   isnull(cheqeCommitments.Amount, 0) -
		   isnull(promissoryCommitments.Amount, 0) -
		   isnull(guarantyCommitments.Amount, 0) as remain
	from REQ.ReceiveRequest r

	left join (
	            select b.ReceiveRequestID, sum(a.Amount) as Amount
				from FIN.ReceiveCheqeCommitment a
				join FIN.ReceiveCommitment b on a.ReceiveCommitmentID = b.ReceiveCommitmentID
				where b.ReceiveRequestID is not null
				group by b.ReceiveRequestID
	          ) cheqeCommitments on r.ReceiveRequestID = cheqeCommitments.ReceiveRequestID

	left join (
	            select b.ReceiveRequestID, sum(a.Amount) as Amount
				from FIN.ReceivePromissoryCommitment a
				join FIN.ReceiveCommitment b on a.ReceiveCommitmentID = b.ReceiveCommitmentID
				where b.ReceiveRequestID is not null
				group by b.ReceiveRequestID
	          ) promissoryCommitments on r.ReceiveRequestID = promissoryCommitments.ReceiveRequestID

	left join (
	            select b.ReceiveRequestID, sum(a.Amount) as Amount
				from FIN.ReceiveGuarantyCommitment a
				join FIN.ReceiveCommitment b on a.ReceiveCommitmentID = b.ReceiveCommitmentID
				where b.ReceiveRequestID is not null
				group by b.ReceiveRequestID
	          ) guarantyCommitments on r.ReceiveRequestID = guarantyCommitments.ReceiveRequestID
