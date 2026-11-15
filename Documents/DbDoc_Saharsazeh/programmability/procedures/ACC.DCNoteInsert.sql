CREATE PROCEDURE [ACC].[DCNoteInsert]
    @dlid INT ,
    @str VARCHAR(MAX)
AS
    DECLARE @UserId INT ,
        @UserName NVARCHAR(560) ,
        @DlTitle NVARCHAR(560) ,
        @Number INT ,
        @Date DATE ,
        @Type TINYINT ,
        @FinancialPeriodID INT;


    SET @UserId = CFG.GetuserID();

    SELECT  @UserName = Name
    FROM    CFG.[User]
    WHERE   UserID = @UserId;

    SELECT  @DlTitle = Title
    FROM    ACC.DL
    WHERE   DLID = @dlid;

    SELECT  value voucheritemid
    INTO    #voucheritem
    FROM    CFG.[Split](@str, ',');

	
	 IF  ( SELECT  COUNT(DISTINCT Voucher.BranchID)
                FROM    #voucheritem
                        INNER JOIN
						Acc.VoucherItem
						ON Acc.VoucherItem.VoucherItemID=#voucheritem.voucheritemid
						INNER JOIN Acc.Voucher
						ON Voucher.VoucherID = VoucherItem.VoucherID
						)>1
        BEGIN
	
            SELECT  -3;
            RETURN;
        END;




    IF EXISTS ( SELECT  1
                FROM    #voucheritem
                        INNER JOIN ACC.DCNote AS d ON d.VoucherItemID = #voucheritem.voucheritemid )
        BEGIN
	
            SELECT  -1;
            RETURN;
        END;


    SELECT TOP 1
            @FinancialPeriodID = FinancialPeriodID
    FROM    ACC.VoucherItem vi1
            JOIN #voucheritem vi2 ON vi1.VoucherItemID = vi2.voucheritemid
            JOIN ACC.Voucher v ON v.VoucherID = vi1.VoucherID;


    SET @Number = ISNULL(( SELECT   MAX(Number) + 1
                           FROM     ACC.DCNote
                           WHERE    FinancialPeriodID = @FinancialPeriodID
                         ), 1);

    SELECT  @Date = MAX(v.Date)
    FROM    ACC.VoucherItem vi1
            JOIN #voucheritem vi2 ON vi1.VoucherItemID = vi2.voucheritemid
            JOIN ACC.Voucher v ON v.VoucherID = vi1.VoucherID;



    SELECT  DISTINCT
            FinancialPeriodID
    INTO    #T
    FROM    ACC.VoucherItem vi1
            JOIN #voucheritem vi2 ON vi1.VoucherItemID = vi2.voucheritemid
            JOIN ACC.Voucher v ON v.VoucherID = vi1.VoucherID;


    IF @@ROWCOUNT <> 1
        BEGIN
            SELECT  -2;
            RETURN; 
        END;



DECLARE @D DATETIME
SET @D=GETDATE()


    INSERT  INTO [ACC].[DCNote]
            ( [DlID] ,
              [Number] ,
              [VoucherItemID] ,
              Creator ,
              [Date] ,
              [FinancialPeriodID] ,
              CreationDate ,
              LastEditor ,
              LastEditionDate
            )
            SELECT  @dlid ,
                    @Number ,
                    voucheritemid ,
                    @UserId ,
                    @Date ,
                    @FinancialPeriodID ,
                    @D ,
                    @UserId ,
                   @D
            FROM    #voucheritem;


    SELECT  @Number;
