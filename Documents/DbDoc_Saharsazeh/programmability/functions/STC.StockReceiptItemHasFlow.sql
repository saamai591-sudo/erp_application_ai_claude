---------------------------------------------------------------------------------------------------------------
CREATE   FUNCTION [STC].[StockReceiptItemHasFlow] ( @ID INT, @isAmount BIT)
RETURNS BIT
 --WITH ENCRYPTION
AS
    BEGIN
        DECLARE @Result BIT ,
            @Count INT;

        IF OBJECT_ID('STC.RevisionCostItem') IS NOT NULL
            SET @Count = ISNULL(( SELECT    COUNT(1)
                                  FROM      STC.RevisionCostItem
                                  WHERE     StockReceiptItemID = @ID
                                ), 0); 

        IF ( @Count IS NULL
             OR @Count = 0 AND @isAmount = 1
           )
            BEGIN
   
                DECLARE @baseDocument TINYINT ,
                    @documentType TINYINT ,
                    @price DECIMAL(30, 4) ,
                    @shareOfCosts DECIMAL(30, 4) ,
                    @preVoucherId INT;

                SELECT  @baseDocument = sdtb.BaseEntity ,
                        @documentType = sdt.DocumentType ,
                        @price = sri.Price ,
                        @shareOfCosts = sri.ShareOfCosts ,
                        @preVoucherId = sr.PreVoucherID
                FROM    STC.StockReceiptItem sri
                        JOIN STC.StockReceipt sr ON sr.StockReceiptID = sri.StockReceiptID 
                        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                            ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                        JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
                WHERE   StockReceiptItemID = @ID;

--1. در صورتی رسید انبار از نوع غیر خرید باشد و ریال داشته باشد.
                IF @documentType <> 1
                    AND @price > 0
                    SET @Count = 1;

--2. در صورتی که رسید انبار از نوع خرید باشد و بر مبنای فاکتور خرید نباشد و رسید انبار ریال داشته باشد.
                IF @Count IS NULL
                    OR @Count = 0
                    AND @documentType = 1
                    AND @price > 0
                    AND @baseDocument <> 7
                    SET @Count = 1;

--3. در صورتی که رسید انبار از نوع خرید بر مبنای فاکتور خرید باشد و پیش نویس داشته باشد.
--4. در صورتی که رسید انبار از نوع خرید و بر مبنای فاکتور خرید باشد و سایر هزینه مبلغ داشته باشد.
                IF @Count IS NULL
                    OR @Count = 0
                    AND @documentType = 1
                    AND @price > 0
                    AND @baseDocument = 7
                    AND ( @preVoucherId IS NOT NULL
                          OR @shareOfCosts > 0
                        )
                    SET @Count = 1;
            END;


--IF (@Count is null or @Count = 0 ) and 
-- OBJECT_ID('STC.ReturnStockReceiptItem') IS Not NULL
--SET @Count = ISNULL((select COUNT(1) FROM STC.ReturnStockReceiptItem q
--WHERE q.StockReceiptItemID = @ID ),0) 


        IF ( @Count IS NULL
             OR @Count = 0
           )
            SET @Result = 0;
        ELSE
            SET @Result = 1;

        RETURN @Result;
    END;
