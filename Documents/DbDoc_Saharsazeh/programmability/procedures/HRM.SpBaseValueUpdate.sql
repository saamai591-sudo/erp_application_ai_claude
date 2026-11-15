CREATE PROC [HRM].[SpBaseValueUpdate]
    @BaseValueID INT ,
    @Title NVARCHAR(256) ,
    @Title2 NVARCHAR(256) ,
    @MinValue DECIMAL(18, 4) ,
    @MaxValue DECIMAL(18, 4) ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @Version INT
--WITH ENCRYPTION
AS
    SET NOCOUNT ON; 

    IF @Version <> ( SELECT [Version]
                     FROM   [HRM].[BaseValue]
                     WHERE  [BaseValueID] = @BaseValueID
                   )
        BEGIN
            RAISERROR('Version mismatch...', 16 , 10);
            RETURN;
        END;

    IF EXISTS ( SELECT  1
                FROM    HRM.BaseValueData
                WHERE   BaseValueID = @BaseValueID
                        AND ( ( Value < @MinValue
                                AND @MinValue IS NOT NULL
                              )
                              OR ( Value > @MaxValue
                                   AND @MaxValue IS NOT NULL
                                 )
                            ) )
        BEGIN
			RAISERROR('با توجه به اطلاعات ثبت شده مقدار حداقل و یا حداکثر معتبر نمی باشد.', 16, 12)
            RETURN;
        
        END; 

    SET @Version = @Version + 1; 

    UPDATE  [HRM].[BaseValue]
    SET     [Title] = @Title ,
            [Title2] = @Title2 ,
            MinValue = @MinValue ,
            MaxValue = @MaxValue ,
            [Creator] = @Creator ,
            [CreationDate] = @CreationDate ,
            [LastEditor] = @LastEditor ,
            [LastEditionDate] = @LastEditionDate ,
            [Version] = @Version
    WHERE   [BaseValueID] = @BaseValueID;
	
	-- Begin Return Select <- do not remove
    SELECT   [Version]
		FROM    [HRM].[BaseValue]
    WHERE   [BaseValueID] = @BaseValueID;	
	-- End Return Select <- do not remove
