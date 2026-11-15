
CREATE   VIEW [VND].VWConfirmPurchaseInvoiceNonePayment
AS

-- Existing columns (unchanged meaning): Net, Done, NonPayment.
-- New columns (payment request flow: confirm -> payment request -> payment order -> payment):
--   RequestedTotal  : all not-cancelled payment requests of the confirm (paid or not)
--   PaidByRequest   : payments made through a payment order that contains a request of this confirm
--   PaidDirect      : Done - PaidByRequest
--   RequestedUnpaid : RequestedTotal - PaidByRequest (still reserved for the request path)
--   NonRequested    : Net - RequestedTotal
--   Requestable     : amount that can still be requested = Net - RequestedTotal - PaidDirect
--   DirectPayable   : amount that can be paid directly   = NonPayment - RequestedUnpaid
-- BaseDocumentType 11 = ConfirmPurchaseInvoice, PaymentRequest.Status 4 = cancelled

with cte as
(
	select ConfirmPurchaseInvoiceID , Amount from fin.PettyCashCostItem
	where ConfirmPurchaseInvoiceID is not null
	UNION ALL
	select ConfirmPurchaseInvoiceID , Amount from CFG.DebitCreditNoteItem
	where ConfirmPurchaseInvoiceID is not null
	UNION ALL
	select ConfirmPurchaseInvoiceID , Amount from FIN.ReceiveSubject
	where ConfirmPurchaseInvoiceID is not null
	UNION ALL
	select ConfirmPurchaseInvoiceID , Amount from FIN.PaymentSubject
	where ConfirmPurchaseInvoiceID is not null
	UNION ALL
	select ConfirmPurchaseInvoiceID , Amount from FOS.CreditAllocationItem
	where ConfirmPurchaseInvoiceID is not null
),
requested as
(
	select pri.BaseDocumentID ConfirmPurchaseInvoiceID, sum(ISNULL(pri.Amount, 0)) Requested
	from req.PaymentRequestItem pri
	join req.PaymentRequest prq on prq.PaymentRequestID = pri.PaymentRequestID
	where pri.BaseDocumentType = 11
		and prq.Status <> 4
	group by pri.BaseDocumentID
),
paid_by_request as
(
	select ps.ConfirmPurchaseInvoiceID, sum(ISNULL(ps.Amount, 0)) Paid
	from fin.PaymentSubject ps
	join fin.PaymentReceipt r on r.PaymentReceiptID = ps.PaymentReceiptID
	where ps.ConfirmPurchaseInvoiceID is not null
		and r.PaymentOrderID is not null
		and exists
		(
			select 1
			from req.PaymentOrderItem poi
			join req.PaymentRequestItem pri on pri.PaymentRequestItemID = poi.PaymentRequestItemID
			where poi.PaymentOrderID = r.PaymentOrderID
				and pri.BaseDocumentType = 11
				and pri.BaseDocumentID = ps.ConfirmPurchaseInvoiceID
		)
	group by ps.ConfirmPurchaseInvoiceID
)
	SELECT	t.ConfirmPurchaseInvoiceID,
			t.PurchaseInvoiceID,
			t.Net,
			t.Done,
			t.NonPayment,
			t.RequestedTotal,
			t.PaidByRequest,
			t.Done - t.PaidByRequest PaidDirect,
			t.RequestedTotal - t.PaidByRequest RequestedUnpaid,
			t.Net - t.RequestedTotal NonRequested,
			case when t.Net - t.RequestedTotal - (t.Done - t.PaidByRequest) < 0 then 0
				else t.Net - t.RequestedTotal - (t.Done - t.PaidByRequest) end Requestable,
			case when t.NonPayment - (t.RequestedTotal - t.PaidByRequest) < 0 then 0
				else t.NonPayment - (t.RequestedTotal - t.PaidByRequest) end DirectPayable
	FROM
	(
		SELECT	cpi.ConfirmPurchaseInvoiceID,
				cpi.PurchaseInvoiceID,
				ISNULL(cpi.Amount, 0) + ISNULL(a.Addition, 0) - ISNULL(a.Deduction, 0) Net,
				ISNULL(d.Payed, 0) Done,
				ISNULL(cpi.Amount, 0) + ISNULL(a.Addition, 0) - ISNULL(a.Deduction, 0) - ISNULL(d.Payed, 0) NonPayment,
				ISNULL(rq.Requested, 0) RequestedTotal,
				-- a payment made through the request path can not exceed what was requested
				case when ISNULL(pb.Paid, 0) > ISNULL(rq.Requested, 0) then ISNULL(rq.Requested, 0)
					else ISNULL(pb.Paid, 0) end PaidByRequest
		FROM VND.ConfirmPurchaseInvoice cpi
		left JOIN (
			SELECT
				SUM(ISNULL(cpii.Addition,0)) Addition,
				SUM(ISNULL(cpii.Deduction,0)) Deduction,
				cpii.ConfirmPurchaseInvoiceID
			FROM vnd.ConfirmPurchaseInvoiceItem AS cpii
			GROUP BY cpii.ConfirmPurchaseInvoiceID
			 ) a
				ON a.ConfirmPurchaseInvoiceID=cpi.ConfirmPurchaseInvoiceID
		LEFT JOIN
			(
			select ConfirmPurchaseInvoiceID,sum(ISNULL(Amount, 0)) Payed
			from cte
			group by ConfirmPurchaseInvoiceID
			) d on d.ConfirmPurchaseInvoiceID = cpi.ConfirmPurchaseInvoiceID
		LEFT JOIN requested rq on rq.ConfirmPurchaseInvoiceID = cpi.ConfirmPurchaseInvoiceID
		LEFT JOIN paid_by_request pb on pb.ConfirmPurchaseInvoiceID = cpi.ConfirmPurchaseInvoiceID
	) t
