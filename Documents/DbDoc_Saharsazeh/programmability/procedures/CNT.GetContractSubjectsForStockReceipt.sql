------------------------------------------   
CREATE       PROC [CNT].GetContractSubjectsForStockReceipt
(
    @date DATE,
    @dlId BIGINT,
    @stockId INT
)
--WITH ENCRYPTION

AS
BEGIN

    DECLARE @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @Culture VARCHAR(25),
            @CultureNo TINYINT,
            @branchId INT;

    SELECT @branchId = s.BranchID
    FROM STF.Stock AS s
    WHERE s.StockID = @stockId;

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;
    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE @Culture
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


		select * into #vwContractSubject_Stuff_Non
		from CNT.vwContractSubject_Stuff_Non
		where PartyDlId = @dlId


		select * into #vwStuff
		from Stf.VWStuff


    SELECT cs.ContractSubjectID,
           c.Number,
           CFG.GetCLRSaturnDate(c.Date, @DateFormat, 0, @DateType) AS DateString,
           CASE
               WHEN @CultureNo = 2 THEN
                   s.Title2
               ELSE
                   s.Title
           END AS StuffTitle,
           s.StuffDetailType,
		   s.StuffID,
           s.Code AS StuffCode,
           cs.Quantity AS MainQuantity,
           case when non.QuantityIncreasable = 1 then 0 else  non.Non end Non
    FROM CNT.vwContractSubject AS cs
        JOIN STF.VWStuff AS s
            ON s.StuffID = cs.StuffID
        JOIN CNT.[Contract] AS c
            ON c.ContractID = cs.ContractID
        JOIN CFG.Party AS p
            ON p.PartyID = c.PartyID
        LEFT JOIN     #vwContractSubject_Stuff_Non AS non
            ON non.ContractSubjectID = cs.ContractSubjectID
    WHERE (non.Non > 0 or non.QuantityIncreasable = 1)
          AND c.[Date] <= @date
          AND c.[Status] = 2
          AND p.DlID = @dlId
          AND c.BranchID = @branchId;


END;
