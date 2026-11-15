
------------------------------[STF].StockHasFlow-----------------------------------------------------------------------------------------------------------
CREATE   FUNCTION [STF].[StockHasFlow] 
(
	@ID INT
)
RETURNS BIT
 --WITH ENCRYPTION
AS
BEGIN
    DECLARE @Result BIT, @Count INT 

    --STC	StockReceipt	DeliverStockID
    IF OBJECT_ID('STC.StockReceiptt') IS NOT NULL
        SET @Count = ISNULL(( SELECT    COUNT(1)  FROM      STC.StockReceipt WHERE     DeliverStockID = @ID ), 0);
    --STC	Outgoing	DeliverStockID
    IF ( @Count IS NULL OR @Count = 0) AND OBJECT_ID('STC.Outgoing') IS NOT NULL
        SET @Count = ISNULL(( SELECT COUNT(1) FROM STC.Outgoing WHERE DeliverStockID = @ID), 0); 
    --STC	ReturnStockReceipt	DeliverStockID
    IF ( @Count IS NULL OR @Count = 0) AND OBJECT_ID('STC.ReturnStockReceipt') IS NOT NULL
        SET @Count = ISNULL(( SELECT COUNT(1) FROM STC.ReturnStockReceipt WHERE DeliverStockID = @ID), 0); 
    --STC	TemporaryOutgoing	StockID
    IF ( @Count IS NULL OR @Count = 0) AND OBJECT_ID('STC.TemporaryOutgoing') IS NOT NULL
        SET @Count = ISNULL(( SELECT COUNT(1) FROM STC.TemporaryOutgoing WHERE StockID = @ID), 0); 
    --STC	StockReceipt	StockID
    IF ( @Count IS NULL OR @Count = 0) AND OBJECT_ID('STC.StockReceiptt') IS NOT NULL
        SET @Count = ISNULL(( SELECT COUNT(1) FROM STC.StockReceipt WHERE StockID = @ID), 0);
    --STC	Outgoing	StockID
    IF ( @Count IS NULL OR @Count = 0) AND OBJECT_ID('STC.Outgoing') IS NOT NULL
        SET @Count = ISNULL(( SELECT COUNT(1) FROM STC.Outgoing WHERE StockID = @ID), 0);
    --STC	PricingItem	StockID
    IF ( @Count IS NULL OR @Count = 0) AND OBJECT_ID('STC.PricingItem') IS NOT NULL
        SET @Count = ISNULL(( SELECT COUNT(1) FROM STC.PricingItem WHERE StockID = @ID), 0);
    --STC	ReturnedTemporaryStockReceipt	StockID
    IF ( @Count IS NULL OR @Count = 0) AND OBJECT_ID('STC.ReturnedTemporaryStockReceipt') IS NOT NULL
        SET @Count = ISNULL(( SELECT COUNT(1) FROM STC.ReturnedTemporaryStockReceipt WHERE StockID = @ID), 0);
    --STC	ReturnStockReceipt	StockID
    IF ( @Count IS NULL OR @Count = 0) AND OBJECT_ID('STC.ReturnStockReceipt') IS NOT NULL
        SET @Count = ISNULL(( SELECT COUNT(1) FROM STC.ReturnStockReceipt WHERE StockID = @ID), 0);
    --SLE	Remittance	StockID
    IF ( @Count IS NULL OR @Count = 0) AND OBJECT_ID('SLE.Remittance') IS NOT NULL
        SET @Count = ISNULL(( SELECT COUNT(1) FROM SLE.Remittance WHERE StockID = @ID), 0);
    --STC	ReturnedTemporaryOutgoing	StockID
    IF ( @Count IS NULL OR @Count = 0) AND OBJECT_ID('STC.ReturnedTemporaryOutgoing') IS NOT NULL
        SET @Count = ISNULL(( SELECT COUNT(1) FROM STC.ReturnedTemporaryOutgoing WHERE StockID = @ID), 0);
    --STC	JustificationInput	StockID
    IF ( @Count IS NULL OR @Count = 0) AND OBJECT_ID('STC.JustificationInput') IS NOT NULL
        SET @Count = ISNULL(( SELECT COUNT(1) FROM STC.JustificationInput WHERE StockID = @ID), 0);

    --STC	StockClosingOperation	StockID
    IF ( @Count IS NULL OR @Count = 0) AND OBJECT_ID('STC.StockClosingOperation') IS NOT NULL
        SET @Count = ISNULL(( SELECT COUNT(1) FROM STC.StockClosingOperation WHERE StockID = @ID), 0);

    --STC	RecountingInventoryPeriod	StockID
    IF ( @Count IS NULL OR @Count = 0) AND OBJECT_ID('STC.RecountingInventoryPeriod') IS NOT NULL
        SET @Count = ISNULL(( SELECT COUNT(1) FROM STC.RecountingInventoryPeriod WHERE StockID = @ID), 0);

    --REQ	ReturnRequest	StockID
    IF ( @Count IS NULL OR @Count = 0) AND OBJECT_ID('REQ.ReturnRequest') IS NOT NULL
        SET @Count = ISNULL(( SELECT COUNT(1) FROM REQ.ReturnRequest WHERE StockID = @ID), 0);

    --STC	TemporaryStockReceipt	StockID
    IF ( @Count IS NULL OR @Count = 0) AND OBJECT_ID('STC.TemporaryStockReceipt') IS NOT NULL
        SET @Count = ISNULL(( SELECT COUNT(1) FROM STC.TemporaryStockReceipt WHERE StockID = @ID), 0);

    --STC	ReturnedOutgoing	StockID
    IF ( @Count IS NULL OR @Count = 0) AND OBJECT_ID('STC.ReturnedOutgoing') IS NOT NULL
        SET @Count = ISNULL(( SELECT COUNT(1) FROM STC.ReturnedOutgoing WHERE StockID = @ID), 0);

    IF (@Count is null or @Count = 0 )
    SET @Result = 0
    ELSE
    SET @Result = 1

    RETURN @Result
END
