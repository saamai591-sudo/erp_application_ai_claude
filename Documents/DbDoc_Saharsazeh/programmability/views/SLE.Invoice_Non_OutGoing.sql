
------------------------------------------------
Create   VIEW [SLE].Invoice_Non_OutGoing
AS 

with cte1
as
(
    SELECT oi.InvoiceItemID,
           oi.MainQuantity,
           oi.SubQuantity
    FROM   stc.OutgoingItem AS oi
	WHERE oi.InvoiceItemID IS NOT null

	union all

    SELECT ri.InvoiceItemID,
           oi.MainQuantity,
           oi.SubQuantity
    FROM   sle.RemittanceItem AS ri
    INNER JOIN STC.OutgoingItem AS oi
        ON  oi.RemittanceItemID = ri.RemittanceItemID
	WHERE ri.InvoiceItemID IS NOT null
),
cte2
as
(
	select  InvoiceItemID,
            SUM(MainQuantity) MainQuantity,
            SUM(SubQuantity) SubQuantity
	from cte1
	group by InvoiceItemID
),
cte3
as
(
    SELECT  a.InvoiceItemID,
			a.StuffID,h.BranchID,
			h.SaleInvoiceStatus,
			s.Type,
			a.MainQuantity,
			a.SubQuantity,
            case when h.SaleInvoiceStatus = 5 then 0
				 when a.OutgoingItemId is not null then a.MainQuantity
				 when b.InvoiceItemID is not null then b.MainQuantity
			     end DoMainQuantity,
            case when a.OutgoingItemId is not null then a.SubQuantity
				 when b.InvoiceItemID is not null then b.SubQuantity
			     end DoSubQuantity
    FROM   sle.InvoiceItem AS a
	INNER JOIN sle.Invoice AS h
		ON a.InvoiceID = h.InvoiceID
    INNER JOIN STF.[Stuff]      AS s
        ON  s.StuffID = a.StuffID
    LEFT JOIN cte2 AS b
        ON  a.InvoiceItemID = b.InvoiceItemID
	where h.BaseDocument <> 13
)
select    InvoiceItemID,
		  StuffID,	
		  BranchID,
		  MainQuantity,
		  SubQuantity,
		  DoMainQuantity,
		  DoSubQuantity,
		  case when SaleInvoiceStatus = 5 then 0 
				when  [type] = 1 or MainQuantity < DoMainQuantity then 0
				else MainQuantity - isnull(DoMainQuantity,0)
		   end                         as non,
		   case 
				when SaleInvoiceStatus = 5 then 0 
				when [type] = 1 or SubQuantity < DoSubQuantity then 0
				else SubQuantity - isnull(DoSubQuantity,0)
		   end                         as subnon
from cte3

