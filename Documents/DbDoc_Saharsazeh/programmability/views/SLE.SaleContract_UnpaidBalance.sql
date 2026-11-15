
------------------------------------------------
CREATE     VIEW [SLE].SaleContract_UnpaidBalance
--with ENCRYPTION
AS 


SELECT *
FROM   (
	select s.SaleContractID,
           s.TotalNetPrice 
		   - ISNULL(DebitCredit.Amount, 0) 
		   - ISNULL(ManualReceipt.Amount, 0) 
		   - isnull(ReceiveSubject.Amount,0)
		   - isnull(Invoice.Amount,0)
		   +
		   case when isnull(pre.Price,0) <= isnull(Invoice.Amount,0)
				then isnull(pre.Price,0)
				else isnull(Invoice.Amount,0)
				end		   
		    as UnpaidBalance
	from SLE.SaleContract s

    LEFT JOIN (SELECT SaleContractID,
                      SUM(Amount) Amount
               FROM CFG.DebitCreditNoteItem
               WHERE SaleContractID IS NOT NULL
               GROUP BY SaleContractID
              ) DebitCredit ON s.SaleContractID = DebitCredit.SaleContractID
    LEFT JOIN (SELECT SaleContractID,
                      SUM(Amount) Amount
               FROM CFG.ManualReceipt
               WHERE SaleContractID IS NOT NULL
               GROUP BY SaleContractID
              ) ManualReceipt ON s.SaleContractID = ManualReceipt.SaleContractID
	LEFT JOIN (SELECT SaleContractID,
                      SUM(a.Amount) Amount
               FROM FIN.ReceiveSubject  a
				left join fin.ReceivedCheqe b on a.ReceivedCheqeID = b.ReceivedCheqeID
               WHERE SaleContractID IS NOT NULL
			   and (b.LastState is null or b.LastState <> 2)
               GROUP BY SaleContractID
              ) ReceiveSubject ON s.SaleContractID = ReceiveSubject.SaleContractID
               
	LEFT JOIN (select SaleContractID,sum(Amount) Amount
				from
				(
					select s.SaleContractID,
							sum(ii.NetPrice) Amount
					from SLE.InvoiceItem ii
					JOIN sle.Invoice AS i ON i.InvoiceID = ii.InvoiceID
					join SLE.SaleContractItem s 
						on ii.SaleContractItemID = s.SaleContractItemID
					WHERE i.SaleInvoiceStatus<>5
					group by s.SaleContractID

					union all

					select s.SaleContractID,
							sum(ii.NetPrice) Amount
					from SLE.InvoiceItem ii
					JOIN sle.Invoice AS i ON i.InvoiceID = ii.InvoiceID
					join stc.OutgoingItem oi
						on ii.OutgoingItemId = oi.OutgoingItemID
					join SLE.SaleContractItem s 
						on oi.SaleContractItemID = s.SaleContractItemID
					WHERE i.SaleInvoiceStatus<>5
					group by s.SaleContractID

					union all

					select s.SaleContractID,
							sum(ii.NetPrice) Amount
					from SLE.InvoiceItem ii
					JOIN sle.Invoice AS i ON i.InvoiceID = ii.InvoiceID
					join sle.RemittanceItem ri
						on ii.RemittanceItemID = ri.RemittanceItemID
					join SLE.SaleContractItem s 
						on ri.SaleContractItemID = s.SaleContractItemID
						WHERE i.SaleInvoiceStatus<>5
					group by s.SaleContractID

					union all

					select s.SaleContractID,
							sum(ii.NetPrice) Amount
					from SLE.InvoiceItem ii
					JOIN sle.Invoice AS i ON i.InvoiceID = ii.InvoiceID
					join stc.OutgoingItem oi
						on ii.OutgoingItemId = oi.OutgoingItemID
					join sle.RemittanceItem ri
						on oi.RemittanceItemID = ri.RemittanceItemID
					join SLE.SaleContractItem s 
						on ri.SaleContractItemID = s.SaleContractItemID
						WHERE i.SaleInvoiceStatus<>5
					group by s.SaleContractID

				)A group by SaleContractID
			  ) Invoice on s.SaleContractID = Invoice.SaleContractID			    
	left join (
				select SaleContractID,sum(Price) Price
				from
					(
						select b.SaleContractID,a.Price
						from sle.InvoicePreReceive a
						join fin.ReceiveSubject b
							on a.ReceiveSubjectID = b.ReceiveSubjectID
						where b.SaleContractID is not null

						union all

						select b.SaleContractID,a.Price
						from sle.InvoicePreReceive a
						join cfg.DebitCreditNoteItem b
							on a.DebitCreditNoteItemID = b.DebitCreditNoteItemID
						where b.SaleContractID is not null
					)A
				group by SaleContractID
			  ) Pre on pre.SaleContractID = s.SaleContractID
			  
	)T

