
--==============================================Alter spDeliveryUpdate
CREATE   PROC [POS].[spDeliveryUpdate] 
    @DeliveryID INT,
    @FinancialPeriodID INT,
    @StationShiftID INT,
    @OutgoingID INT,
	@ReturnedOutgoingID INT,
    @Number INT,
    @Date DATE,
    @PreVoucherID INT = NULL,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Version INT,
    @Status TINYINT
AS 
    SET NOCOUNT ON 

    IF @Version = (SELECT [Version] FROM [POS].[Delivery]
				   WHERE [DeliveryID] = @DeliveryID)
    BEGIN
        SET 
			@Version = @Version + 1 
    
        DECLARE 
			@CompanyID INT

	    SELECT 
		    @CompanyID = b.CompanyID 
	    FROM 
		    POS.Delivery d
	    JOIN 
		    POS.StationShift ssh
	    ON
		    d.StationShiftID = ssh.StationShiftID
	    JOIN
		    POS.Station s
	    ON
		    ssh.StationID = s.StationID 
	    JOIN
		    CFG.Branch b
	    ON
		    s.BranchID = b.BranchID
	    WHERE 
		    d.StationShiftID = @StationShiftID
	
	    IF(@Number = 0 OR @Number IS NULL)
	    SET 
		    @Number = ISNULL(
						    (SELECT 
							    MAX(Number) + 1
						    FROM 
							    Pos.Delivery d
						    JOIN 
							    POS.StationShift ssh
						    ON
							    d.StationShiftID = ssh.StationShiftID
						    JOIN
							    POS.Station s
						    ON
							    ssh.StationID = s.StationID 
						    JOIN
							    CFG.Branch b
						    ON
							    s.BranchID = b.BranchID
						    WHERE 
							    d.FinancialPeriodID = @FinancialPeriodID AND 
                                b.CompanyID = @CompanyID)
						    , 1) 

        UPDATE 
			[POS].[Delivery]
        SET    
			[FinancialPeriodID] = @FinancialPeriodID,
            [StationShiftID] = @StationShiftID,
            [Number] = @Number,
            [Date] = @Date,
            PreVoucherID = @PreVoucherID,
            [Creator] = @Creator,
            [CreationDate] = @CreationDate,
            [LastEditor] = @LastEditor,
            [LastEditionDate] = @LastEditionDate,
            [Version] = @Version,
            [Status] = @Status
        WHERE  
			[DeliveryID] = @DeliveryID
    
        -- Begin Return Select <- do not remove
        SELECT  
			[Version],
            [Number]
        FROM   
			[POS].[Delivery]
        WHERE  
			[DeliveryID] = @DeliveryID 
        -- End Return Select <- do not remove
    END
