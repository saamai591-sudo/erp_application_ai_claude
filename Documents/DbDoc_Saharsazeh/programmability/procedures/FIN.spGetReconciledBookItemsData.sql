
-----------------------------------------
CREATE  
PROC FIN.spGetReconciledBookItemsData
(@ReconciliationID INT)
--WITH ENCRYPTION
AS
DECLARE @UserID INT,
        @DateType TINYINT,
        @DateFormat VARCHAR(10);

SET @UserID = CFG.GetuserID();

SELECT @DateType = us.SettingValue
FROM CFG.UserSetting us
WHERE us.SettingKey = 'Date_Type'
      AND us.UserID = @UserID;

IF @DateType IS NULL
    SET @DateType = CASE CFG.GetuserCulture()
                        WHEN 'fa' THEN
                            0
                        WHEN 'en' THEN
                            1
                        WHEN 'ar' THEN
                            2
                    END;

SELECT @DateFormat = us.SettingValue
FROM CFG.UserSetting us
WHERE us.SettingKey = 'Date_Format'
      AND us.UserID = @UserID;

IF @DateFormat IS NULL
    SET @DateFormat = 'YY/MM/DD';

        BEGIN

        DECLARE @CashToBank NVARCHAR(100) ,
                @CashFromBank NVARCHAR(100) ,
                @Payment NVARCHAR(100) ,
                @BankDraft NVARCHAR(100) ,
                @TodayCheqe NVARCHAR(100) ,
                @Outgoing NVARCHAR(100) ,
                @TransferToBank NVARCHAR(100) ,
                @PaymentCheqeCashing NVARCHAR(100) ,
                @DrawBackedCheque NVARCHAR(100)

            SELECT  @CashToBank = lev.[Value]
            FROM    CFG.LocalizeEnum le
                    JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
            WHERE   le.Enum = 'CheqeStateInReceive'
                    AND le.Item = 'CashToBank'
                    AND lev.Culture = CFG.GetuserCulture()

            SELECT  @CashFromBank = lev.[Value]
            FROM    CFG.LocalizeEnum le
                    JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
            WHERE   le.Enum = 'CheqeStateInReceive'
                    AND le.Item = 'CashFromBank'
                    AND lev.Culture = CFG.GetuserCulture()
	
            SELECT  @BankDraft = lev.[Value]
            FROM    CFG.LocalizeEnum le
                    JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
            WHERE   le.Enum = 'PaymentMethod'
                    AND le.Item = 'BankDraft'
                    AND lev.Culture = CFG.GetuserCulture()

            SELECT  @TodayCheqe = lev.[Value]
            FROM    CFG.LocalizeEnum le
                    JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
            WHERE   le.Enum = 'CheqeStateInPayment'
                    AND le.Item = 'TodayCheqe'
                    AND lev.Culture = CFG.GetuserCulture()
            
			SELECT  @Outgoing = lev.[Value]
            FROM    CFG.LocalizeEnum le
                    JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
            WHERE   le.Enum = 'SaleAndPurchaseBill'
                    AND le.Item = 'ReceivedBankDraft'
                    AND lev.Culture = CFG.GetuserCulture()

            SELECT  @TransferToBank = lev.[Value]
            FROM    CFG.LocalizeEnum le
                    JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
            WHERE   le.Enum = 'Others'
                    AND le.Item = 'TransferToBank'
                    AND lev.Culture = CFG.GetuserCulture()
		
            SELECT  @PaymentCheqeCashing = lev.[Value]
            FROM    CFG.LocalizeEnum le
                    JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
            WHERE   le.Enum = 'Others'
                    AND le.Item = 'PaymentCheqeCashing'
                    AND lev.Culture = CFG.GetuserCulture()

            SELECT  @DrawBackedCheque = lev.[Value]
            FROM    CFG.LocalizeEnum le
                    JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
            WHERE   le.Enum = 'PaymentCheqeCommitmentState'
                    AND le.Item = 'DrawBacked'
                    AND lev.Culture = CFG.GetuserCulture()
	
        END
SELECT i.ReconciledBookItemID,
       i.ReconciliationID,
       i.EntityType,
       CASE
           WHEN EntityType = 1 THEN @Outgoing
           WHEN EntityType = 2 THEN @CashToBank
           WHEN EntityType = 3 THEN @CashFromBank
           WHEN EntityType = 4 THEN @TransferToBank
           WHEN EntityType = 5 THEN @BankDraft
           WHEN EntityType = 6 THEN @TodayCheqe
           WHEN EntityType = 7 THEN @PaymentCheqeCashing
           WHEN EntityType = 8 THEN bi.Description
           WHEN EntityType = 9 THEN @DrawBackedCheque
           WHEN EntityType = 10
                OR EntityType = 11 THEN
               'وصول ضمانت نامه'
		   WHEN EntityType = 12 THEN N'دریافت فروشگاهی'
       END AS EntityName,
       CASE
           WHEN EntityType = 1 THEN
               rbd.ReceiveReceiptID
           WHEN EntityType = 2 THEN
               rcfi.ReceiptCheqeFlowID
           WHEN EntityType = 3 THEN
               rcfi2.ReceiptCheqeFlowID
           WHEN EntityType = 4 THEN
               ps.PaymentReceiptID
           WHEN EntityType = 5 THEN
               pbd.PaymentReceiptID
           WHEN EntityType = 6 THEN
               pc.PaymentReceiptID
           WHEN EntityType = 7 THEN
               pcfi.PaymentCheqeFlowID
           WHEN EntityType = 8 THEN
               bi.BookID
           WHEN EntityType = 9 THEN
               pcfi2.PaymentCheqeFlowID
           WHEN EntityType = 10
                OR EntityType = 11 THEN
               g.GuarantyOperationID
		    WHEN EntityType = 12 THEN pr.PosReceiptID
       END AS MasterID,
       CASE
           WHEN EntityType = 1 THEN
               'ReceiveReceipt'
           WHEN EntityType = 2
                OR EntityType = 3 THEN
               'ReceiptCheqeFlow'
           WHEN EntityType = 4
                OR EntityType = 5
                OR EntityType = 6 THEN
               'PaymentReceipt'
           WHEN EntityType = 7
                OR EntityType = 9 THEN
               'PaymentCheqeFlow'
           WHEN EntityType = 8 THEN
               'Book'
           WHEN EntityType = 10
                OR EntityType = 11 THEN
               'GuarantyOperation'
		   WHEN EntityType = 12 THEN
               'PosReceipt'
       END AS EngName,
       i.EntityID,
       i.Number,
       i.Date,
       CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) PersianDate,
       i.Deposite,
       i.Withdraw,
       i.Passed,
       i.Version,
       i.Creator,
       i.CreationDate,
       i.Description,
       i.PartyID,
       i.VoucherID,
       cast(v.Number as varchar(500)) AS VoucherNumber,
       CASE CFG.GetuserCulture()
           WHEN 'fa' THEN
               p.Title +' ' + isnull(p.LastName,'')
           ELSE
               p.Title2 +' '+ isnull(p.LastName2,'')
       END PartyName
FROM FIN.ReconciledBookItem i
    LEFT JOIN FIN.ReceivedBankDraft rbd
        ON i.EntityID = rbd.ReceivedBankDraftID
           AND i.EntityType = 1
    LEFT JOIN FIN.ReceiptCheqeFlowItem rcfi
        ON i.EntityID = rcfi.ReceiptCheqeFlowItemID
           AND i.EntityType = 2
           AND rcfi.State = 4
    LEFT JOIN FIN.ReceiptCheqeFlowItem rcfi2
        ON i.EntityID = rcfi2.ReceiptCheqeFlowItemID
           AND i.EntityType = 3
           AND rcfi2.State = 6
    LEFT JOIN FIN.PaymentSubject ps
        ON i.EntityID = ps.PaymentSubjectID
           AND i.EntityType = 4
    LEFT JOIN FIN.PaymentBankDraft pbd
        ON i.EntityID = pbd.PaymentBankDraftID
           AND i.EntityType = 5
    LEFT JOIN FIN.PaymentCheqe pc
        ON i.EntityID = pc.PaymentCheqeID
           AND i.EntityType = 6
    LEFT JOIN
    (
        SELECT a.PaymentCheqeFlowItemID,
               a.PaymentCheqeFlowID
        FROM FIN.PaymentCheqeFlowItem a
            JOIN FIN.PaymentCheqeFlow b
                ON a.PaymentCheqeFlowID = b.PaymentCheqeFlowID
        WHERE b.Type = 0
    ) pcfi
        ON i.EntityID = pcfi.PaymentCheqeFlowItemID
           AND i.EntityType = 7
    LEFT JOIN FIN.BookItem bi
        ON i.EntityID = bi.BookItemID
           AND i.EntityType = 8
    LEFT JOIN
    (
        SELECT c.PaymentCheqeFlowItemID,
               c.PaymentCheqeFlowID
        FROM FIN.PaymentCheqeFlowItem c
            JOIN FIN.PaymentCheqeFlow d
                ON c.PaymentCheqeFlowID = d.PaymentCheqeFlowID
            JOIN FIN.PaymentCheqe e
                ON c.PaymentCheqeID = e.PaymentCheqeID
            JOIN FIN.PaymentCheqeType f
                ON e.PaymentCheqeTypeID = f.PaymentCheqeTypeID
        WHERE d.[Type] = 1
              AND f.Today = 1
    ) pcfi2
        ON i.EntityID = pcfi2.PaymentCheqeFlowItemID
           AND i.EntityType = 9
    LEFT JOIN FIN.GuarantyOperation g
        ON i.EntityID = g.GuarantyOperationID
           AND i.EntityType IN ( 10, 11 )
    left JOIN ACC.Voucher v
        ON i.VoucherID = v.VoucherID
    left JOIN CFG.Party p
        ON i.PartyID = p.PartyID
    left JOIN pos.PosReceiptItem pr
        ON i.EntityID = pr.PosReceiptitemID
		and i.EntityType = 12
WHERE i.ReconciliationID = @ReconciliationID;
