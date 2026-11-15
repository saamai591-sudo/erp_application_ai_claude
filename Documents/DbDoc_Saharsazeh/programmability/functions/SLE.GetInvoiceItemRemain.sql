/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 06/08/95 12:49:42 عصر
 ************************************************************/

CREATE FUNCTION [SLE].[GetInvoiceItemRemain]
(
	@invoiceItemId     INT,
	@isSub             BIT
)
RETURNS DECIMAL(18, 4)

BEGIN
	RETURN (
	    SELECT TOP 1 CASE 
	                      WHEN @isSub=1 THEN ir.NonSub
	                      ELSE ir.Non
	                 END
	    FROM   sle.Invoice_Remains AS ir
	    WHERE  ir.InvoiceItemID = @invoiceItemId
	)
	
	
END 
