/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.2.349
 * Time: 3/5/2018 4:20:03 PM
 ************************************************************/

CREATE PROCEDURE [CFG].[GetSeasonFileSarjam](@FinancialPeriodID INT, @Season INT)
AS
	SELECT
	0 AS SeasonFileID,
	 sf.DOCType,sf.ArzType,
	SUM(sf.Amount  ) AS Amount  ,
	SUM(Tax  ) AS Tax  ,
	SUM(Duty  ) AS Duty  ,
	SUM(Discount  ) AS Discount  ,
	SUM(Arz_Price  ) AS Arz_Price  ,
	SUM(Arz_MaliatArzeshAfzoodeh  ) AS Arz_MaliatArzeshAfzoodeh  ,
	SUM(Arz_AvarezArzeshAfzoodeh  ) AS Arz_AvarezArzeshAfzoodeh  ,
	SUM(Arz_SayerAvarez  ) AS Arz_SayerAvarez  ,
	SUM(Arz_TakhfifPrice  ) AS Arz_TakhfifPrice  ,
	SUM(ArzBarabari_Price  ) AS ArzBarabari_Price  ,
	SUM(ArzBarabari_TakhfifPrice  ) AS ArzBarabari_TakhfifPrice  
	FROM   cfg.SeasonFile AS sf
	WHERE  sf.FinancialPeriodID = @FinancialPeriodID
	       AND sf.Season = @Season
	       AND sf.LessThanQuorum=1
	GROUP BY sf.DOCType,sf.ArzType
	
	
	